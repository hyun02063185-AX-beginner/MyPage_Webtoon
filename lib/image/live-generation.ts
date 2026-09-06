import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getImageRuntime } from "@/lib/config/image-runtime";
import { buildImagePrompt, hashPrompt } from "@/lib/image/prompt";
import type { MockGenerationInput, MockGenerationResult } from "@/lib/image/generation";

const LOCK_DURATION_MS = 5 * 60 * 1000;

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isKnownPrismaConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function safeError(error: unknown) {
  if (error instanceof OpenAI.APIError) {
    if (error.code === "moderation_blocked") return { code: "MODERATION_BLOCKED", message: "안전 정책으로 이미지 생성이 차단되었습니다. 프롬프트를 수정해 다시 시도해 주세요.", requestId: error.requestID ?? null };
    if (error.status === 401 || error.status === 403) return { code: "API_AUTH_FAILED", message: "OpenAI API 인증이 거부되었습니다. API 키와 프로젝트 권한을 확인해 주세요.", requestId: error.requestID ?? null };
    if (error.status === 429) return { code: "EXTERNAL_RATE_LIMIT", message: "OpenAI 요청 한도에 도달했습니다. 잠시 뒤 다시 시도해 주세요.", requestId: error.requestID ?? null };
    return { code: "EXTERNAL_API_ERROR", message: "OpenAI 이미지 생성에 실패했습니다. 생성 이력을 보존했으니 다시 시도할 수 있습니다.", requestId: error.requestID ?? null };
  }
  return { code: "EXTERNAL_API_ERROR", message: "이미지 생성 연결에 실패했습니다. 생성 이력을 보존했으니 다시 시도할 수 있습니다.", requestId: null };
}

async function writeLiveImage(projectId: string, attemptId: string, bytes: Buffer) {
  const relativePath = path.posix.join("storage", "projects", projectId, "attempts", attemptId, "source.webp");
  const storageRoot = path.resolve(process.cwd(), "storage");
  const absolutePath = path.join(storageRoot, "projects", projectId, "attempts", attemptId, "source.webp");
  if (!absolutePath.startsWith(`${storageRoot}${path.sep}`)) throw new Error("IMAGE_SAVE_ERROR");
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, bytes, { flag: "wx" });
  return { relativePath, absolutePath, checksum: sha256(bytes) };
}

/**
 * Creates an immutable attempt before the paid request, then stores the exact returned WebP.
 * It intentionally never turns an API failure into a mock result.
 */
export async function createLiveImageAttempt(input: MockGenerationInput): Promise<MockGenerationResult> {
  const runtime = getImageRuntime();
  if (runtime.mode !== "live") return { kind: "rejected", code: "SCENARIO_NOT_APPROVED" };
  if (!runtime.apiKey) return { kind: "rejected", code: "SCENARIO_NOT_APPROVED" };

  const existing = await db.imageAttempt.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, status: true } });
  if (existing) return { kind: "idempotent", attemptId: existing.id, status: existing.status };

  const expiresAt = new Date(Date.now() + LOCK_DURATION_MS);
  let attemptId: string;
  let projectId: string;

  try {
    const created = await db.$transaction(async (tx) => {
      await tx.generationLock.deleteMany({ where: { projectId: input.projectId, expiresAt: { lte: new Date() } } });
      const project = await tx.project.findUnique({
        where: { id: input.projectId },
        include: { selectedScenarioVersion: true, imageAttempts: { orderBy: { createdAt: "desc" }, include: { imageReview: true } } },
      });
      if (!project) return { kind: "rejected" as const, code: "PROJECT_NOT_FOUND" as const };
      const scenario = project.selectedScenarioVersion;
      if (project.status !== "SCENARIO_APPROVED" || !scenario?.approvedAt) return { kind: "rejected" as const, code: "SCENARIO_NOT_APPROVED" as const };
      const rejectedAttempt = project.imageAttempts.find((attempt) => attempt.imageReview?.result === "REJECTED");
      if (rejectedAttempt && (input.parentAttemptId !== rejectedAttempt.id || input.regenerationMode !== "MODIFIED_PROMPT" || !input.regenerationReason?.trim())) {
        return { kind: "rejected" as const, code: "INVALID_REGENERATION" as const };
      }
      if (input.parentAttemptId) {
        const parent = await tx.imageAttempt.findFirst({ where: { id: input.parentAttemptId, projectId: project.id } });
        if (!parent || (input.regenerationMode === "SAME_PROMPT" && input.regenerationReason)) return { kind: "rejected" as const, code: "INVALID_REGENERATION" as const };
      }

      await tx.generationLock.create({ data: { projectId: project.id, idempotencyKey: input.idempotencyKey, expiresAt } });
      const parent = input.parentAttemptId
        ? await tx.imageAttempt.findFirst({ where: { id: input.parentAttemptId, projectId: project.id }, select: { promptSnapshot: true } })
        : null;
      const promptSnapshot = input.regenerationMode === "SAME_PROMPT" && parent
        ? parent.promptSnapshot
        : buildImagePrompt(project, scenario, input.regenerationMode === "MODIFIED_PROMPT" ? input.regenerationReason : undefined);
      const attempt = await tx.imageAttempt.create({
        data: {
          projectId: project.id,
          scenarioVersionId: scenario.id,
          parentAttemptId: input.parentAttemptId,
          idempotencyKey: input.idempotencyKey,
          promptSnapshot,
          promptHash: hashPrompt(promptSnapshot),
          requestedModel: runtime.model,
          size: runtime.size,
          quality: runtime.quality,
          outputFormat: "webp",
          outputCompression: runtime.outputCompression,
          source: "OPENAI",
          status: "GENERATING",
          isMock: false,
          regenerationMode: input.regenerationMode ?? "ORIGINAL",
          regenerationReason: input.regenerationReason,
        },
      });
      await tx.project.update({ where: { id: project.id }, data: { status: "IMAGE_GENERATING" } });
      return { kind: "created" as const, attemptId: attempt.id, projectId: project.id, promptSnapshot };
    });
    if (created.kind === "rejected") return created;
    attemptId = created.attemptId;
    projectId = created.projectId;

    const client = new OpenAI({ apiKey: runtime.apiKey, maxRetries: 0 });
    const response = await client.images.generate({
      model: runtime.model,
      prompt: created.promptSnapshot,
      n: 1,
      size: runtime.size,
      quality: runtime.quality,
      output_format: "webp",
      output_compression: runtime.outputCompression,
    });
    const imageBase64 = response.data?.[0]?.b64_json;
    if (!imageBase64) throw new Error("IMAGE_RESPONSE_EMPTY");
    const saved = await writeLiveImage(projectId, attemptId, Buffer.from(imageBase64, "base64"));

    await db.$transaction(async (tx) => {
      await tx.imageAttempt.update({
        where: { id: attemptId },
        data: { status: "READY", responseModel: runtime.model, providerRequestId: response._request_id ?? null, filePath: saved.relativePath, fileSha256: saved.checksum, completedAt: new Date() },
      });
      await tx.generationLock.deleteMany({ where: { projectId } });
      await tx.project.update({ where: { id: projectId }, data: { status: "IMAGE_REVIEW" } });
    });
    return { kind: "created", attemptId, status: "READY" };
  } catch (error) {
    if (isKnownPrismaConflict(error)) {
      const sameRequest = await db.imageAttempt.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, status: true } });
      if (sameRequest) return { kind: "idempotent", attemptId: sameRequest.id, status: sameRequest.status };
      return { kind: "rejected", code: "GENERATION_IN_PROGRESS" };
    }
    if (!attemptId! || !projectId!) throw error;
    const failure = safeError(error);
    await db.$transaction(async (tx) => {
      await tx.imageAttempt.update({ where: { id: attemptId }, data: { status: "FAILED", completedAt: new Date(), errorCode: failure.code, safeErrorMessage: failure.message, providerRequestId: failure.requestId } });
      await tx.generationLock.deleteMany({ where: { projectId } });
      await tx.project.update({ where: { id: projectId }, data: { status: "SCENARIO_APPROVED" } });
    });
    return { kind: "created", attemptId, status: "FAILED" };
  }
}

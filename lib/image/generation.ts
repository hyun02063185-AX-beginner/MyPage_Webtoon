import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildImagePrompt, hashPrompt } from "@/lib/image/prompt";

const LOCK_DURATION_MS = 5 * 60 * 1000;

export type MockGenerationInput = {
  projectId: string;
  idempotencyKey: string;
  parentAttemptId?: string;
  regenerationMode?: "ORIGINAL" | "SAME_PROMPT" | "MODIFIED_PROMPT";
  regenerationReason?: string;
  /** Test-only adapter switch. It is not accepted from UI form data. */
  forceFailure?: boolean;
};

export type MockGenerationResult =
  | { kind: "created"; attemptId: string; status: "READY" | "FAILED" }
  | { kind: "idempotent"; attemptId: string; status: string }
  | { kind: "rejected"; code: "PROJECT_NOT_FOUND" | "SCENARIO_NOT_APPROVED" | "SCENARIO_VERSION_MISMATCH" | "GENERATION_IN_PROGRESS" | "INVALID_REGENERATION" };

type RuntimeImageOptions = {
  plannedLiveModel: string;
  size: string;
  quality: string;
  outputFormat: string;
  outputCompression: number | null;
};

function getMockOptions(): RuntimeImageOptions {
  return {
    plannedLiveModel: process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2",
    size: process.env.OPENAI_IMAGE_SIZE?.trim() || "1536x1024",
    quality: process.env.OPENAI_IMAGE_QUALITY?.trim() || "medium",
    outputFormat: "mock",
    outputCompression: null,
  };
}

function isKnownPrismaConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createMockImageAttempt(input: MockGenerationInput): Promise<MockGenerationResult> {
  const existing = await db.imageAttempt.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, status: true } });
  if (existing) return { kind: "idempotent", attemptId: existing.id, status: existing.status };

  const options = getMockOptions();
  const expiresAt = new Date(Date.now() + LOCK_DURATION_MS);
  let attemptId: string;

  try {
    const created = await db.$transaction(async (tx) => {
      // Expired locks never authorize a second live request; they only release a stale local/mock worker.
      await tx.generationLock.deleteMany({ where: { projectId: input.projectId, expiresAt: { lte: new Date() } } });

      const project = await tx.project.findUnique({
        where: { id: input.projectId },
        include: { selectedScenarioVersion: true },
      });
      if (!project) return { kind: "rejected" as const, code: "PROJECT_NOT_FOUND" as const };
      const scenario = project.selectedScenarioVersion;
      if (project.status !== "SCENARIO_APPROVED" || !scenario?.approvedAt) {
        return { kind: "rejected" as const, code: "SCENARIO_NOT_APPROVED" as const };
      }
      if (input.parentAttemptId) {
        const parent = await tx.imageAttempt.findFirst({ where: { id: input.parentAttemptId, projectId: project.id } });
        if (!parent) return { kind: "rejected" as const, code: "INVALID_REGENERATION" as const };
        if (input.regenerationMode === "SAME_PROMPT" && input.regenerationReason) {
          return { kind: "rejected" as const, code: "INVALID_REGENERATION" as const };
        }
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
          requestedModel: "MOCK_PHASE_4",
          size: options.size,
          quality: options.quality,
          outputFormat: options.outputFormat,
          outputCompression: options.outputCompression,
          status: "GENERATING",
          isMock: true,
          regenerationMode: input.regenerationMode ?? "ORIGINAL",
          regenerationReason: input.regenerationReason,
        },
      });
      await tx.project.update({ where: { id: project.id }, data: { status: "IMAGE_GENERATING" } });
      return { kind: "created" as const, attemptId: attempt.id };
    });

    if (created.kind === "rejected") return created;
    attemptId = created.attemptId;
  } catch (error) {
    if (isKnownPrismaConflict(error)) {
      const sameRequest = await db.imageAttempt.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, status: true } });
      if (sameRequest) return { kind: "idempotent", attemptId: sameRequest.id, status: sameRequest.status };
      return { kind: "rejected", code: "GENERATION_IN_PROGRESS" };
    }
    throw error;
  }

  const completedAt = new Date();
  if (input.forceFailure) {
    await db.$transaction(async (tx) => {
      await tx.imageAttempt.update({
        where: { id: attemptId },
        data: {
          status: "FAILED",
          completedAt,
          errorCode: "MOCK_GENERATION_FAILED",
          safeErrorMessage: "MOCK 생성 어댑터 실패가 안전하게 기록되었습니다. 승인된 시나리오로 다시 시도할 수 있습니다.",
        },
      });
      await tx.generationLock.delete({ where: { projectId: input.projectId } });
      await tx.project.update({ where: { id: input.projectId }, data: { status: "SCENARIO_APPROVED" } });
    });
    return { kind: "created", attemptId, status: "FAILED" };
  }

  await db.$transaction(async (tx) => {
    await tx.imageAttempt.update({
      where: { id: attemptId },
      data: { status: "READY", completedAt, responseModel: "MOCK_PHASE_4" },
    });
    await tx.generationLock.delete({ where: { projectId: input.projectId } });
    await tx.project.update({ where: { id: input.projectId }, data: { status: "IMAGE_REVIEW" } });
  });
  return { kind: "created", attemptId, status: "READY" };
}

export function getMockPromptPreview(project: Parameters<typeof buildImagePrompt>[0], scenario: Parameters<typeof buildImagePrompt>[1]) {
  const prompt = buildImagePrompt(project, scenario);
  const options = getMockOptions();
  return { prompt, promptHash: hashPrompt(prompt), options };
}

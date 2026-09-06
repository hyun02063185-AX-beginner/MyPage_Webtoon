import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { db } from "@/lib/db";
import { getImageRuntime } from "@/lib/config/image-runtime";
import { resolveLegacyAsset } from "@/lib/legacy/scanner";

export const legacyPromptUnavailable = "LEGACY_ASSET_PROMPT_UNAVAILABLE";

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function legacyProjectConcept(fileName: string) {
  const parsed = path.parse(fileName).name.trim();
  return (parsed || "과거 웹툰 원본").slice(0, 80);
}

function legacyPanels() {
  return [1, 2, 3, 4].map((number) => ({
    number,
    scene: "원본의 이 컷을 직접 확인합니다.",
    dialogues: ["원본 대사 정보 없음 — 이미지에서 직접 확인"],
  }));
}

export type LegacyImportResult =
  | { kind: "imported"; projectId: string }
  | { kind: "already-imported"; projectId: string }
  | { kind: "rejected"; code: "ASSET_NOT_FOUND" | "SOURCE_CHANGED" | "CONVERSION_FAILED" | "FILE_WRITE_FAILED" };

/**
 * Copies an explicitly selected legacy original into managed storage as WebP.
 * The original stays untouched; no prompt is invented for an asset that has none.
 */
export async function importLegacyAsset(assetRef: string): Promise<LegacyImportResult> {
  const asset = await resolveLegacyAsset(assetRef);
  if (!asset) return { kind: "rejected", code: "ASSET_NOT_FOUND" };

  const existing = await db.imageAttempt.findUnique({ where: { legacyAssetRef: asset.assetRef }, select: { projectId: true } });
  if (existing) return { kind: "already-imported", projectId: existing.projectId };

  let originalBytes: Buffer;
  try {
    originalBytes = await fs.readFile(asset.absolutePath);
  } catch {
    return { kind: "rejected", code: "ASSET_NOT_FOUND" };
  }
  if (sha256(originalBytes) !== asset.sha256) return { kind: "rejected", code: "SOURCE_CHANGED" };

  let webpBytes: Buffer;
  try {
    webpBytes = await sharp(originalBytes, { animated: false })
      .rotate()
      .webp({ quality: getImageRuntime().outputCompression })
      .toBuffer();
  } catch {
    return { kind: "rejected", code: "CONVERSION_FAILED" };
  }

  const convertedHash = sha256(webpBytes);
  const sourceSize = asset.width && asset.height ? `${asset.width}x${asset.height}` : "unknown";
  const imported = await db.$transaction(async (tx) => {
    const duplicate = await tx.imageAttempt.findUnique({ where: { legacyAssetRef: asset.assetRef }, select: { projectId: true } });
    if (duplicate) return { kind: "duplicate" as const, projectId: duplicate.projectId };

    const project = await tx.project.create({
      data: {
        concept: legacyProjectConcept(asset.fileName),
        audience: "기존 갤러리 독자",
        purpose: "과거 원본을 출처·프롬프트 부재 정보와 함께 검수 후 내보내기",
        style: "LEGACY 원본",
        memo: `원본 파일: ${asset.fileName}\n원본 SHA-256: ${asset.sha256}\npromptUnavailable=true`,
        status: "IMAGE_REVIEW",
      },
    });
    const scenario = await tx.scenarioVersion.create({
      data: {
        projectId: project.id,
        version: 1,
        term: legacyProjectConcept(asset.fileName),
        title: `${legacyProjectConcept(asset.fileName)} · 과거 원본 검수`,
        audience: "기존 갤러리 독자",
        coreMessage: "원본 프롬프트와 생성 모델 정보가 없는 과거 자산입니다.",
        background: "원본 이미지 자체를 사람 검수합니다.",
        characterGuide: "원본 정보 없음",
        panelsJson: JSON.stringify(legacyPanels()),
        finalCaption: "LEGACY 원본 · 프롬프트 정보 없음",
        sourceModel: "LEGACY_IMPORT",
        approvedAt: new Date(),
      },
    });
    const attempt = await tx.imageAttempt.create({
      data: {
        projectId: project.id,
        scenarioVersionId: scenario.id,
        idempotencyKey: `legacy-import:${asset.sha256}`,
        promptSnapshot: legacyPromptUnavailable,
        promptHash: sha256(Buffer.from(legacyPromptUnavailable, "utf8")),
        requestedModel: "LEGACY_ORIGINAL",
        size: sourceSize,
        quality: "source-converted",
        outputFormat: "webp",
        outputCompression: getImageRuntime().outputCompression,
        source: "LEGACY",
        legacyAssetRef: asset.assetRef,
        legacyOriginalFileName: asset.fileName,
        legacyOriginalSha256: asset.sha256,
        status: "READY",
        isMock: false,
        filePath: path.posix.join("storage", "projects", project.id, "attempts", "pending", "source.webp"),
        fileSha256: convertedHash,
        regenerationMode: "ORIGINAL",
        completedAt: new Date(),
      },
    });
    const filePath = path.posix.join("storage", "projects", project.id, "attempts", attempt.id, "source.webp");
    await tx.imageAttempt.update({ where: { id: attempt.id }, data: { filePath } });
    await tx.project.update({ where: { id: project.id }, data: { selectedScenarioVersionId: scenario.id } });
    return { kind: "created" as const, projectId: project.id, attemptId: attempt.id, filePath };
  });

  if (imported.kind === "duplicate") return { kind: "already-imported", projectId: imported.projectId };

  const storageRoot = path.resolve(process.cwd(), "storage");
  const destination = path.join(storageRoot, "projects", imported.projectId, "attempts", imported.attemptId, "source.webp");
  try {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, webpBytes, { flag: "wx" });
  } catch {
    await db.$transaction(async (tx) => {
      await tx.imageAttempt.update({ where: { id: imported.attemptId }, data: { status: "FAILED", filePath: null, fileSha256: null, errorCode: "LEGACY_FILE_WRITE_FAILED", safeErrorMessage: "LEGACY WebP 사본을 저장하지 못했습니다." } });
      await tx.project.update({ where: { id: imported.projectId }, data: { status: "SCENARIO_APPROVED" } });
    });
    return { kind: "rejected", code: "FILE_WRITE_FAILED" };
  }

  return { kind: "imported", projectId: imported.projectId };
}

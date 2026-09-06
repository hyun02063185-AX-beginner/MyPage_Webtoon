import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { buildGalleryExport } from "@/lib/export/contract";
import { checkExportEligibility } from "@/lib/export/eligibility";
import { canTransitionProject } from "@/lib/domain/project-status";

export type CreateExportResult =
  | { kind: "created"; bundleId: string }
  | { kind: "blocked"; code: "REVIEW_REQUIRED" | "MOCK_EXPORT_BLOCKED" | "IMAGE_FILE_MISSING" | "EXPORT_VALIDATION_ERROR" };

function sha256(data: Buffer) {
  return createHash("sha256").update(data).digest("hex");
}

function isWithin(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function isWebp(bytes: Buffer) {
  return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

/**
 * Writes a local folder bundle only for a non-MOCK, human-passed, checksum-verified WebP.
 * It never synthesizes image bytes, and cleans temporary output if a write or DB transaction fails.
 */
export async function createGalleryExport(projectId: string): Promise<CreateExportResult> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { selectedImageAttempt: { include: { imageReview: true } } },
  });
  if (!project) return { kind: "blocked", code: "REVIEW_REQUIRED" };

  const eligibility = checkExportEligibility(project);
  if (!eligibility.ok) return { kind: "blocked", code: eligibility.code };
  const attempt = project.selectedImageAttempt!;
  const storageRoot = path.resolve(process.cwd(), "storage");
  if (path.isAbsolute(attempt.filePath!)) return { kind: "blocked", code: "IMAGE_FILE_MISSING" };
  const sourcePath = path.resolve(storageRoot, path.relative("storage", attempt.filePath!));
  if (!isWithin(storageRoot, sourcePath)) return { kind: "blocked", code: "IMAGE_FILE_MISSING" };

  let sourceBytes: Buffer;
  try {
    sourceBytes = await fs.readFile(sourcePath);
  } catch {
    return { kind: "blocked", code: "IMAGE_FILE_MISSING" };
  }
  if (!isWebp(sourceBytes) || sha256(sourceBytes) !== attempt.fileSha256) return { kind: "blocked", code: "IMAGE_FILE_MISSING" };

  const bundleId = randomUUID();
  const exportsRoot = path.join(storageRoot, "exports");
  const temporaryDirectory = path.join(exportsRoot, `.${bundleId}.tmp`);
  const finalDirectory = path.join(exportsRoot, bundleId);
  const imageFileName = `${eligibility.metadata.slug}.webp`;
  const jsonFileName = `${eligibility.metadata.slug}.json`;
  const imagePath = path.join(finalDirectory, imageFileName);
  const jsonPath = path.join(finalDirectory, jsonFileName);
  const jsonBytes = Buffer.from(JSON.stringify(buildGalleryExport({
    ...eligibility.metadata,
    concept: project.concept,
    prompt: attempt.promptSnapshot,
    model: attempt.responseModel ?? attempt.requestedModel,
    imageFileName,
    exportedAt: new Date(),
  }), null, 2), "utf8");

  try {
    await fs.mkdir(temporaryDirectory, { recursive: true });
    await fs.writeFile(path.join(temporaryDirectory, imageFileName), sourceBytes, { flag: "wx" });
    await fs.writeFile(path.join(temporaryDirectory, jsonFileName), jsonBytes, { flag: "wx" });
    await fs.rename(temporaryDirectory, finalDirectory);
    const bundle = await db.$transaction(async (tx) => {
      const latest = await tx.exportBundle.aggregate({ where: { projectId }, _max: { exportVersion: true } });
      const currentProject = await tx.project.findUnique({ where: { id: projectId }, include: { selectedImageAttempt: { include: { imageReview: true } } } });
      if (!currentProject || currentProject.status !== "APPROVED_FOR_EXPORT" || !canTransitionProject("APPROVED_FOR_EXPORT", "EXPORTED")) throw new Error("EXPORT_STATE_CHANGED");
      const latestEligibility = checkExportEligibility(currentProject);
      if (!latestEligibility.ok || currentProject.selectedImageAttemptId !== attempt.id) throw new Error("EXPORT_STATE_CHANGED");
      const created = await tx.exportBundle.create({
        data: {
          id: bundleId,
          projectId,
          imageAttemptId: attempt.id,
          exportVersion: (latest._max.exportVersion ?? 0) + 1,
          imagePath,
          jsonPath,
          archivePath: finalDirectory,
          imageSha256: sha256(sourceBytes),
          jsonSha256: sha256(jsonBytes),
        },
      });
      await tx.project.update({ where: { id: projectId }, data: { status: "EXPORTED" } });
      return created;
    });
    return { kind: "created", bundleId: bundle.id };
  } catch (error) {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
    await fs.rm(finalDirectory, { recursive: true, force: true });
    if (error instanceof Error && error.message === "EXPORT_STATE_CHANGED") return { kind: "blocked", code: "REVIEW_REQUIRED" };
    throw error;
  }
}

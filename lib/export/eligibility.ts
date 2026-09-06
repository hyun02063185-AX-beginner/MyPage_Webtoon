import type { ImageAttempt, ImageReview, Project } from "@prisma/client";
import { galleryMetadataSchema, type GalleryMetadata } from "@/lib/export/contract";

type ExportCandidate = Pick<Project, "status" | "slug" | "title" | "imageAlt" | "paragraphsJson" | "selectedImageAttemptId"> & {
  selectedImageAttempt: (Pick<ImageAttempt, "id" | "isMock" | "status" | "filePath" | "fileSha256" | "outputFormat"> & { imageReview: Pick<ImageReview, "result"> | null }) | null;
};

export type ExportBlockCode = "REVIEW_REQUIRED" | "MOCK_EXPORT_BLOCKED" | "IMAGE_FILE_MISSING" | "EXPORT_VALIDATION_ERROR";
export type ExportEligibility = { ok: true; metadata: GalleryMetadata } | { ok: false; code: ExportBlockCode };

export function parseStoredMetadata(project: Pick<Project, "slug" | "title" | "imageAlt" | "paragraphsJson">): GalleryMetadata | null {
  let paragraphs: unknown = [];
  try {
    paragraphs = project.paragraphsJson ? JSON.parse(project.paragraphsJson) : [];
  } catch {
    return null;
  }
  const result = galleryMetadataSchema.safeParse({ slug: project.slug, title: project.title, imageAlt: project.imageAlt, paragraphs });
  return result.success ? result.data : null;
}

/** Server-side export gate. UI state is informational; this function is authoritative. */
export function checkExportEligibility(project: ExportCandidate): ExportEligibility {
  const attempt = project.selectedImageAttempt;
  if (project.status !== "APPROVED_FOR_EXPORT" || !attempt || attempt.imageReview?.result !== "PASSED") {
    return { ok: false, code: "REVIEW_REQUIRED" };
  }
  if (attempt.isMock) return { ok: false, code: "MOCK_EXPORT_BLOCKED" };
  if (attempt.status !== "READY" || !attempt.filePath || !attempt.fileSha256 || attempt.outputFormat.toLowerCase() !== "webp") {
    return { ok: false, code: "IMAGE_FILE_MISSING" };
  }
  const metadata = parseStoredMetadata(project);
  return metadata ? { ok: true, metadata } : { ok: false, code: "EXPORT_VALIDATION_ERROR" };
}

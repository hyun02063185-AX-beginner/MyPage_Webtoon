import { describe, expect, it } from "vitest";
import { buildGalleryExport, galleryMetadataSchema, parseParagraphs } from "@/lib/export/contract";
import { checkExportEligibility } from "@/lib/export/eligibility";

const metadata = {
  slug: "api-request-response",
  title: "API를 4컷으로 이해하기",
  imageAlt: "요청과 응답을 설명하는 네 컷 교육 만화",
  paragraphs: ["첫 번째 해설", "두 번째 해설"],
};

describe("gallery export contract", () => {
  it("validates the public JSON contract and preserves Korean UTF-8 strings", () => {
    const exported = buildGalleryExport({
      ...metadata,
      concept: "API",
      prompt: "실제 API에 전송한 프롬프트",
      model: "gpt-image-2",
      imageFileName: "api-request-response.webp",
      exportedAt: new Date("2026-09-06T12:00:00.000Z"),
    });
    expect(exported).toEqual(expect.objectContaining({ createdAt: "2026-09-06", image: "api-request-response.webp", concept: "API" }));
    expect(JSON.parse(JSON.stringify(exported)).paragraphs).toEqual(metadata.paragraphs);
  });

  it("rejects unsafe slugs and empty explanation paragraphs", () => {
    expect(galleryMetadataSchema.safeParse({ ...metadata, slug: "API file" }).success).toBe(false);
    expect(galleryMetadataSchema.safeParse({ ...metadata, paragraphs: [] }).success).toBe(false);
    expect(parseParagraphs("첫 문단\n\n둘째 문단")).toEqual(["첫 문단", "둘째 문단"]);
  });

  it("blocks MOCK attempts even after a human PASS and never treats them as exportable", () => {
    const result = checkExportEligibility({
      status: "APPROVED_FOR_EXPORT",
      selectedImageAttemptId: "attempt-1",
      slug: metadata.slug,
      title: metadata.title,
      imageAlt: metadata.imageAlt,
      paragraphsJson: JSON.stringify(metadata.paragraphs),
      selectedImageAttempt: {
        id: "attempt-1", isMock: true, status: "READY", filePath: null, fileSha256: null, outputFormat: "mock",
        imageReview: { result: "PASSED" },
      },
    });
    expect(result).toEqual({ ok: false, code: "MOCK_EXPORT_BLOCKED" });
  });

  it("requires a verified WebP path as well as human review", () => {
    const result = checkExportEligibility({
      status: "APPROVED_FOR_EXPORT",
      selectedImageAttemptId: "attempt-1",
      slug: metadata.slug,
      title: metadata.title,
      imageAlt: metadata.imageAlt,
      paragraphsJson: JSON.stringify(metadata.paragraphs),
      selectedImageAttempt: {
        id: "attempt-1", isMock: false, status: "READY", filePath: null, fileSha256: "sha", outputFormat: "webp",
        imageReview: { result: "PASSED" },
      },
    });
    expect(result).toEqual({ ok: false, code: "IMAGE_FILE_MISSING" });
  });
});

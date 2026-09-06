import { z } from "zod";

export const galleryMetadataSchema = z.object({
  slug: z.string().trim().min(1, "slug을 입력해 주세요.").max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug은 영문 소문자·숫자·하이픈만 사용할 수 있습니다."),
  title: z.string().trim().min(1, "제목을 입력해 주세요.").max(160),
  imageAlt: z.string().trim().min(1, "이미지 설명을 입력해 주세요.").max(500),
  paragraphs: z.array(z.string().trim().min(1).max(1200)).min(1, "해설 문단을 한 개 이상 입력해 주세요.").max(8),
});

export type GalleryMetadata = z.infer<typeof galleryMetadataSchema>;

export const galleryExportSchema = z.object({
  slug: galleryMetadataSchema.shape.slug,
  concept: z.string().trim().min(1).max(80),
  title: galleryMetadataSchema.shape.title,
  image: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/),
  imageAlt: galleryMetadataSchema.shape.imageAlt,
  prompt: z.string().min(1),
  model: z.string().min(1),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paragraphs: galleryMetadataSchema.shape.paragraphs,
}).strict();

export type GalleryExport = z.infer<typeof galleryExportSchema>;

export function buildGalleryExport(input: Omit<GalleryExport, "image" | "createdAt"> & { imageFileName: string; exportedAt: Date }): GalleryExport {
  const { imageFileName, exportedAt, ...content } = input;
  return galleryExportSchema.parse({
    ...content,
    image: imageFileName,
    createdAt: formatExportDate(exportedAt),
  });
}

export function parseParagraphs(value: FormDataEntryValue | null): string[] {
  return String(value ?? "").split(/\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

export function formatExportDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

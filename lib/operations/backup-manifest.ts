import { z } from "zod";

const safeRelativePath = z.string().min(1).refine(
  (value) => !value.includes("\\") && !value.startsWith("/") && !value.split("/").some((part) => part === "" || part === "." || part === ".."),
  "백업 manifest 경로는 루트 기준의 안전한 상대 경로여야 합니다.",
);

export const backupManifestFileSchema = z.object({
  path: safeRelativePath,
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export const backupManifestSchema = z.object({
  formatVersion: z.literal(1),
  createdAt: z.string().datetime({ offset: true }),
  databaseRelativePath: z.literal("app.db"),
  files: z.array(backupManifestFileSchema).min(1),
}).superRefine((manifest, context) => {
  const paths = new Set<string>();
  for (const [index, file] of manifest.files.entries()) {
    if (paths.has(file.path)) {
      context.addIssue({ code: "custom", path: ["files", index, "path"], message: "백업 manifest에 중복 파일 경로가 있습니다." });
    }
    paths.add(file.path);
  }
  if (!paths.has(manifest.databaseRelativePath)) {
    context.addIssue({ code: "custom", path: ["files"], message: "백업 manifest에 app.db가 없습니다." });
  }
});

export type BackupManifest = z.infer<typeof backupManifestSchema>;

export function parseBackupManifest(value: unknown): BackupManifest {
  return backupManifestSchema.parse(value);
}

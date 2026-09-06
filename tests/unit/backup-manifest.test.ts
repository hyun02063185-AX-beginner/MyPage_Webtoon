import { describe, expect, it } from "vitest";
import { parseBackupManifest } from "@/lib/operations/backup-manifest";

const validManifest = {
  formatVersion: 1,
  createdAt: "2026-09-06T12:00:00.000Z",
  databaseRelativePath: "app.db",
  files: [
    { path: "app.db", bytes: 4096, sha256: "a".repeat(64) },
    { path: "storage/exports/example/example.json", bytes: 128, sha256: "b".repeat(64) },
  ],
};

describe("backup manifest validation", () => {
  it("accepts a checksummed database and storage manifest", () => {
    expect(parseBackupManifest(validManifest)).toEqual(validManifest);
  });

  it("rejects paths that could escape the backup directory", () => {
    expect(() => parseBackupManifest({ ...validManifest, files: [{ ...validManifest.files[0], path: "../app.db" }] })).toThrow();
  });

  it("rejects manifests without the database or with duplicate paths", () => {
    expect(() => parseBackupManifest({ ...validManifest, files: [validManifest.files[1]] })).toThrow();
    expect(() => parseBackupManifest({ ...validManifest, files: [validManifest.files[0], validManifest.files[0]] })).toThrow();
  });
});

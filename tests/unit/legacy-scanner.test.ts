import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildLegacySelectionManifest, resolveLegacyAsset, scanLegacyAssets } from "@/lib/legacy/scanner";

const temporaryRoots: string[] = [];

async function makeLegacyRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "webtoon-legacy-"));
  temporaryRoots.push(root);
  return root;
}

function pngHeader(width: number, height: number) {
  const bytes = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("legacy asset scanner", () => {
  it("records LEGACY provenance, dimensions, a SHA-256 reference, and no inferred prompt", async () => {
    const root = await makeLegacyRoot();
    await fs.writeFile(path.join(root, "old-comic.png"), pngHeader(1024, 1536));

    const manifest = await scanLegacyAssets(root);

    expect(manifest.assets).toHaveLength(1);
    expect(manifest.assets[0]).toMatchObject({ source: "LEGACY", promptUnavailable: true, fileName: "old-comic.png", format: "png", width: 1024, height: 1536 });
    expect(manifest.assets[0].assetRef).toMatch(/^LEGACY:[a-f0-9]{64}$/);
    expect(manifest.dimensionGroups).toEqual([{ label: "1024 × 1536", count: 1 }]);
  });

  it("does not change a legacy original while scanning or preparing a selected manifest", async () => {
    const root = await makeLegacyRoot();
    const filePath = path.join(root, "preserve-me.png");
    const original = pngHeader(800, 1200);
    await fs.writeFile(filePath, original);
    const beforeBytes = await fs.readFile(filePath);
    const beforeHash = createHash("sha256").update(beforeBytes).digest("hex");
    const beforeStat = await fs.stat(filePath);

    const manifest = await scanLegacyAssets(root);
    const selection = buildLegacySelectionManifest(manifest.assets, [manifest.assets[0].assetRef]);
    const afterBytes = await fs.readFile(filePath);
    const afterStat = await fs.stat(filePath);

    expect(createHash("sha256").update(afterBytes).digest("hex")).toBe(beforeHash);
    expect(afterBytes).toEqual(beforeBytes);
    expect(afterStat.size).toBe(beforeStat.size);
    expect(afterStat.mtimeMs).toBe(beforeStat.mtimeMs);
    expect(selection).toEqual([expect.objectContaining({ importAction: "PENDING_EXPLICIT_IMPORT", promptUnavailable: true, source: "LEGACY" })]);
  });

  it("resolves only an opaque hash reference and never accepts a filename as a path", async () => {
    const root = await makeLegacyRoot();
    await fs.writeFile(path.join(root, "safe.png"), pngHeader(640, 640));
    const manifest = await scanLegacyAssets(root);

    await expect(resolveLegacyAsset(manifest.assets[0].assetRef, root)).resolves.toMatchObject({ fileName: "safe.png" });
    await expect(resolveLegacyAsset("../safe.png", root)).resolves.toBeNull();
    await expect(resolveLegacyAsset("LEGACY:not-a-hash", root)).resolves.toBeNull();
  });
});

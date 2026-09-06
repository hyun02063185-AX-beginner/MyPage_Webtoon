import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export const LEGACY_ASSET_SOURCE = "LEGACY" as const;
const supportedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const legacyReferencePattern = /^LEGACY:[a-f0-9]{64}$/;

export type LegacyImageFormat = "png" | "jpeg" | "webp" | "gif" | "unknown";

export type LegacyAsset = {
  assetRef: string;
  source: typeof LEGACY_ASSET_SOURCE;
  promptUnavailable: true;
  fileName: string;
  sha256: string;
  sizeBytes: number;
  format: LegacyImageFormat;
  width: number | null;
  height: number | null;
};

export type LegacyManifest = {
  source: typeof LEGACY_ASSET_SOURCE;
  promptUnavailable: true;
  rootLabel: "backup_images";
  assets: LegacyAsset[];
  dimensionGroups: Array<{ label: string; count: number }>;
  skippedFiles: string[];
};

type ResolvedLegacyAsset = LegacyAsset & { absolutePath: string };

function isWithin(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseJpegDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    offset += 2;
    while (marker === 0xff && offset < bytes.length) offset += 1;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  return null;
}

function parseImageMetadata(bytes: Buffer): Pick<LegacyAsset, "format" | "width" | "height"> {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.subarray(12, 16).toString("ascii") === "IHDR") {
    return { format: "png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  const jpeg = parseJpegDimensions(bytes);
  if (jpeg) return { format: "jpeg", ...jpeg };
  if (bytes.length >= 10 && bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.length >= 10 && bytes.subarray(0, 6).toString("ascii") === "GIF89a") {
    return { format: "gif", width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  if (bytes.length >= 30 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    const chunk = bytes.subarray(12, 16).toString("ascii");
    if (chunk === "VP8X") return { format: "webp", width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { format: "webp", width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") return { format: "webp", width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]), height: 1 + (((bytes[24] & 0xf) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xc0) >> 6)) };
    return { format: "webp", width: null, height: null };
  }
  return { format: "unknown", width: null, height: null };
}

function legacyRoot(inputRoot?: string) {
  if (inputRoot) return path.resolve(/* turbopackIgnore: true */ inputRoot);
  return path.join(process.cwd(), "backup_images");
}

async function scanResolvedAssets(inputRoot?: string): Promise<{ assets: ResolvedLegacyAsset[]; skippedFiles: string[] }> {
  const root = legacyRoot(inputRoot);
  let resolvedRoot: string;
  try {
    resolvedRoot = await fs.realpath(/* turbopackIgnore: true */ root);
  } catch {
    return { assets: [], skippedFiles: [] };
  }
  const entries = await fs.readdir(resolvedRoot, { withFileTypes: true });
  const assets: ResolvedLegacyAsset[] = [];
  const skippedFiles: string[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!supportedExtensions.has(extension)) {
      skippedFiles.push(entry.name);
      continue;
    }
    const candidatePath = path.resolve(resolvedRoot, entry.name);
    let realCandidatePath: string;
    try {
      realCandidatePath = await fs.realpath(candidatePath);
    } catch {
      skippedFiles.push(entry.name);
      continue;
    }
    if (!isWithin(resolvedRoot, realCandidatePath)) {
      skippedFiles.push(entry.name);
      continue;
    }
    const [bytes, stat] = await Promise.all([fs.readFile(realCandidatePath), fs.stat(realCandidatePath)]);
    const metadata = parseImageMetadata(bytes);
    const hash = sha256(bytes);
    assets.push({
      assetRef: `LEGACY:${hash}`,
      source: LEGACY_ASSET_SOURCE,
      promptUnavailable: true,
      fileName: entry.name,
      sha256: hash,
      sizeBytes: stat.size,
      ...metadata,
      absolutePath: realCandidatePath,
    });
  }
  assets.sort((left, right) => left.fileName.localeCompare(right.fileName, "ko"));
  return { assets, skippedFiles: skippedFiles.sort((left, right) => left.localeCompare(right, "ko")) };
}

export async function scanLegacyAssets(inputRoot?: string): Promise<LegacyManifest> {
  const { assets: resolvedAssets, skippedFiles } = await scanResolvedAssets(inputRoot);
  const assets = resolvedAssets.map(({ absolutePath, ...asset }) => {
    void absolutePath;
    return asset;
  });
  const groups = new Map<string, number>();
  for (const asset of assets) {
    const label = asset.width && asset.height ? `${asset.width} × ${asset.height}` : "해상도 식별 불가";
    groups.set(label, (groups.get(label) ?? 0) + 1);
  }
  return {
    source: LEGACY_ASSET_SOURCE,
    promptUnavailable: true,
    rootLabel: "backup_images",
    assets,
    dimensionGroups: [...groups.entries()].map(([label, count]) => ({ label, count })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
    skippedFiles,
  };
}

/** Resolves only an opaque LEGACY:<sha256> reference; filenames never become input paths. */
export async function resolveLegacyAsset(assetRef: string, inputRoot?: string): Promise<ResolvedLegacyAsset | null> {
  if (!legacyReferencePattern.test(assetRef)) return null;
  const { assets } = await scanResolvedAssets(inputRoot);
  return assets.find((asset) => asset.assetRef === assetRef) ?? null;
}

export function buildLegacySelectionManifest(assets: LegacyAsset[], selectedRefs: readonly string[]) {
  const selected = new Set(selectedRefs.filter((assetRef) => legacyReferencePattern.test(assetRef)));
  return assets.filter((asset) => selected.has(asset.assetRef)).map((asset) => ({
    assetRef: asset.assetRef,
    fileName: asset.fileName,
    sha256: asset.sha256,
    source: asset.source,
    promptUnavailable: asset.promptUnavailable,
    importAction: "PENDING_EXPLICIT_IMPORT" as const,
  }));
}

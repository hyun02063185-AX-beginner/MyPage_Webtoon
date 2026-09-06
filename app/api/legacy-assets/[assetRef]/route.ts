import { readFile } from "node:fs/promises";
import { resolveLegacyAsset } from "@/lib/legacy/scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contentTypes = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
} as const;

export async function GET(_request: Request, { params }: RouteContext<"/api/legacy-assets/[assetRef]">) {
  const { assetRef } = await params;
  const asset = await resolveLegacyAsset(assetRef);
  if (!asset || asset.format === "unknown") return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(asset.absolutePath);
    return new Response(bytes, {
      headers: {
        "Content-Type": contentTypes[asset.format],
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="legacy-preview"`,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

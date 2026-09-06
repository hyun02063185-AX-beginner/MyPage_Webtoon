import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";

function isWithin(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attempt = await db.imageAttempt.findUnique({ where: { id }, select: { isMock: true, status: true, filePath: true } });
  if (!attempt || attempt.isMock || attempt.status !== "READY" || !attempt.filePath || path.isAbsolute(attempt.filePath)) {
    return new Response("Not found", { status: 404 });
  }

  const storageRoot = path.resolve(process.cwd(), "storage");
  const filePath = path.resolve(storageRoot, path.relative("storage", attempt.filePath));
  if (!isWithin(storageRoot, filePath)) return new Response("Not found", { status: 404 });
  try {
    const bytes = await fs.readFile(filePath);
    return new Response(bytes, { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

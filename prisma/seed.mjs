import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

const prisma = new PrismaClient();
const terms = JSON.parse(await readFile(new URL("./seed-data/terms.json", import.meta.url), "utf8"));

for (const item of terms) {
  const normalizedKey = item.term.trim().toLocaleLowerCase("ko-KR");
  await prisma.term.upsert({
    where: { normalizedKey },
    update: { definition: item.definition, category: item.category, source: "CURATED_20260906" },
    create: { ...item, normalizedKey, source: "CURATED_20260906" },
  });
}

console.log(`Seeded ${terms.length} curated terms.`);
await prisma.$disconnect();

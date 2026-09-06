import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("curated term seed", () => {
  it("contains exactly 100 unique, complete non-legacy terms", async () => {
    const source = await readFile("prisma/seed-data/terms.json", "utf8");
    const terms: Array<{ term: string; definition: string; category: string }> = JSON.parse(source);
    expect(terms).toHaveLength(100);
    expect(new Set(terms.map((term) => term.term)).size).toBe(100);
    expect(terms.every((term) => term.term && term.definition && term.category)).toBe(true);
  });
});

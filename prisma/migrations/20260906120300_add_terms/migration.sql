-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "term" TEXT NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CURATED_20260906',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Term_normalizedKey_key" ON "Term"("normalizedKey");

-- CreateIndex
CREATE INDEX "Term_term_idx" ON "Term"("term");

-- CreateIndex
CREATE INDEX "Term_category_idx" ON "Term"("category");

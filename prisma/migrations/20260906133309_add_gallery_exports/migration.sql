-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "concept" TEXT NOT NULL,
    "slug" TEXT,
    "title" TEXT,
    "imageAlt" TEXT,
    "paragraphsJson" TEXT,
    "audience" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "memo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "selectedScenarioVersionId" TEXT,
    "selectedImageAttemptId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_selectedScenarioVersionId_fkey" FOREIGN KEY ("selectedScenarioVersionId") REFERENCES "ScenarioVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_selectedImageAttemptId_fkey" FOREIGN KEY ("selectedImageAttemptId") REFERENCES "ImageAttempt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("audience", "concept", "createdAt", "id", "imageAlt", "memo", "paragraphsJson", "purpose", "selectedImageAttemptId", "selectedScenarioVersionId", "slug", "status", "style", "title", "updatedAt") SELECT "audience", "concept", "createdAt", "id", "imageAlt", "memo", "paragraphsJson", "purpose", "selectedImageAttemptId", "selectedScenarioVersionId", "slug", "status", "style", "title", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");
CREATE UNIQUE INDEX "Project_selectedScenarioVersionId_key" ON "Project"("selectedScenarioVersionId");
CREATE UNIQUE INDEX "Project_selectedImageAttemptId_key" ON "Project"("selectedImageAttemptId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

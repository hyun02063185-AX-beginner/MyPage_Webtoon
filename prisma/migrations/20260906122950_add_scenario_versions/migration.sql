-- CreateTable
CREATE TABLE "ScenarioVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "english" TEXT,
    "title" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "coreMessage" TEXT NOT NULL,
    "background" TEXT NOT NULL,
    "characterGuide" TEXT NOT NULL,
    "panelsJson" TEXT NOT NULL,
    "finalCaption" TEXT NOT NULL,
    "sourceModel" TEXT NOT NULL,
    "sourceResponseId" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScenarioVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "concept" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "memo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "selectedScenarioVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_selectedScenarioVersionId_fkey" FOREIGN KEY ("selectedScenarioVersionId") REFERENCES "ScenarioVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("audience", "concept", "createdAt", "id", "memo", "purpose", "status", "style", "updatedAt") SELECT "audience", "concept", "createdAt", "id", "memo", "purpose", "status", "style", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_selectedScenarioVersionId_key" ON "Project"("selectedScenarioVersionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ScenarioVersion_projectId_createdAt_idx" ON "ScenarioVersion"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioVersion_projectId_version_key" ON "ScenarioVersion"("projectId", "version");

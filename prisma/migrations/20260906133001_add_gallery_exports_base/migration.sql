ALTER TABLE "Project" ADD COLUMN "slug" TEXT;
ALTER TABLE "Project" ADD COLUMN "title" TEXT;
ALTER TABLE "Project" ADD COLUMN "imageAlt" TEXT;
ALTER TABLE "Project" ADD COLUMN "paragraphsJson" TEXT;
ALTER TABLE "Project" ADD COLUMN "selectedImageAttemptId" TEXT;

CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");
CREATE UNIQUE INDEX "Project_selectedImageAttemptId_key" ON "Project"("selectedImageAttemptId");

CREATE TABLE "ExportBundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "imageAttemptId" TEXT NOT NULL,
    "exportVersion" INTEGER NOT NULL,
    "imagePath" TEXT NOT NULL,
    "jsonPath" TEXT NOT NULL,
    "archivePath" TEXT,
    "imageSha256" TEXT NOT NULL,
    "jsonSha256" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExportBundle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExportBundle_imageAttemptId_fkey" FOREIGN KEY ("imageAttemptId") REFERENCES "ImageAttempt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ExportBundle_projectId_exportVersion_key" ON "ExportBundle"("projectId", "exportVersion");
CREATE INDEX "ExportBundle_imageAttemptId_createdAt_idx" ON "ExportBundle"("imageAttemptId", "createdAt");

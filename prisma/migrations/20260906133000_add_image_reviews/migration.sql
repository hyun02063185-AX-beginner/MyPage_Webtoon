CREATE TABLE "ImageReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "imageAttemptId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "panelChecksJson" TEXT NOT NULL,
    "typoFound" BOOLEAN NOT NULL DEFAULT false,
    "missingText" BOOLEAN NOT NULL DEFAULT false,
    "croppedText" BOOLEAN NOT NULL DEFAULT false,
    "layoutIssue" BOOLEAN NOT NULL DEFAULT false,
    "contentIssue" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageReview_imageAttemptId_fkey" FOREIGN KEY ("imageAttemptId") REFERENCES "ImageAttempt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ImageReview_imageAttemptId_key" ON "ImageReview"("imageAttemptId");
CREATE INDEX "ImageReview_result_reviewedAt_idx" ON "ImageReview"("result", "reviewedAt");

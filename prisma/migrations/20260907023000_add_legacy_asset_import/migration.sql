ALTER TABLE "ImageAttempt" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MOCK';
ALTER TABLE "ImageAttempt" ADD COLUMN "legacyAssetRef" TEXT;
ALTER TABLE "ImageAttempt" ADD COLUMN "legacyOriginalFileName" TEXT;
ALTER TABLE "ImageAttempt" ADD COLUMN "legacyOriginalSha256" TEXT;

UPDATE "ImageAttempt" SET "source" = 'OPENAI' WHERE "isMock" = 0;

CREATE UNIQUE INDEX "ImageAttempt_legacyAssetRef_key" ON "ImageAttempt"("legacyAssetRef");

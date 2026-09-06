-- CreateTable
CREATE TABLE "ImageAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "scenarioVersionId" TEXT NOT NULL,
    "parentAttemptId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "promptSnapshot" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "requestedModel" TEXT NOT NULL,
    "responseModel" TEXT,
    "providerRequestId" TEXT,
    "size" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "outputFormat" TEXT NOT NULL,
    "outputCompression" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "isMock" BOOLEAN NOT NULL DEFAULT true,
    "filePath" TEXT,
    "fileSha256" TEXT,
    "regenerationMode" TEXT NOT NULL DEFAULT 'ORIGINAL',
    "regenerationReason" TEXT,
    "errorCode" TEXT,
    "safeErrorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "ImageAttempt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ImageAttempt_scenarioVersionId_fkey" FOREIGN KEY ("scenarioVersionId") REFERENCES "ScenarioVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ImageAttempt_parentAttemptId_fkey" FOREIGN KEY ("parentAttemptId") REFERENCES "ImageAttempt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GenerationLock" (
    "projectId" TEXT NOT NULL PRIMARY KEY,
    "idempotencyKey" TEXT NOT NULL,
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "GenerationLock_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageAttempt_idempotencyKey_key" ON "ImageAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ImageAttempt_projectId_createdAt_idx" ON "ImageAttempt"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ImageAttempt_scenarioVersionId_idx" ON "ImageAttempt"("scenarioVersionId");

-- CreateIndex
CREATE INDEX "ImageAttempt_parentAttemptId_idx" ON "ImageAttempt"("parentAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationLock_idempotencyKey_key" ON "GenerationLock"("idempotencyKey");

-- CreateIndex
CREATE INDEX "GenerationLock_expiresAt_idx" ON "GenerationLock"("expiresAt");

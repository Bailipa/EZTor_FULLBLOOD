-- CreateTable
CREATE TABLE "ExamPaper" (
    "originType" TEXT NOT NULL DEFAULT 'ORIGINAL',
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "rightsHolder" TEXT NOT NULL,
    "rightsEvidence" TEXT NOT NULL,
    "rightsStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "contentHash" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamPaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamAttempt" (
    "revision" INTEGER NOT NULL DEFAULT 0,
    "goalSnapshot" JSONB NOT NULL,
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "startKey" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "stageStartedAt" TIMESTAMP(3) NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "assisted" BOOLEAN NOT NULL DEFAULT false,
    "replayCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "receipt" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamPaper_contentHash_key" ON "ExamPaper"("contentHash");

-- CreateIndex
CREATE INDEX "ExamPaper_level_kind_rightsStatus_createdAt_idx" ON "ExamPaper"("level", "kind", "rightsStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExamPaper_slug_version_key" ON "ExamPaper"("slug", "version");

-- CreateIndex
CREATE INDEX "ExamAttempt_userId_updatedAt_idx" ON "ExamAttempt"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ExamAttempt_userId_startKey_key" ON "ExamAttempt"("userId", "startKey");

-- CreateIndex
CREATE INDEX "ExamEvent_attemptId_createdAt_idx" ON "ExamEvent"("attemptId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExamEvent_userId_clientId_key" ON "ExamEvent"("userId", "clientId");

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "ExamPaper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamEvent" ADD CONSTRAINT "ExamEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

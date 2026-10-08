-- CreateTable
CREATE TABLE "StudyGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "examDate" DATE NOT NULL,
    "targetScore" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPassage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "level" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "rightsHolder" TEXT NOT NULL,
    "rightsEvidence" TEXT NOT NULL,
    "rightsStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "contentHash" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyPassage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "goalRevision" INTEGER NOT NULL,
    "goalSnapshot" JSONB NOT NULL,
    "passageId" TEXT NOT NULL,
    "startKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READING',
    "sentenceIndex" INTEGER NOT NULL DEFAULT 0,
    "questionIndex" INTEGER NOT NULL DEFAULT 0,
    "activeMs" INTEGER NOT NULL DEFAULT 0,
    "assisted" BOOLEAN NOT NULL DEFAULT false,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "activeMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudyGoal_userId_key" ON "StudyGoal"("userId");

-- CreateIndex
CREATE INDEX "StudyPassage_level_rightsStatus_kind_idx" ON "StudyPassage"("level", "rightsStatus", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPassage_slug_version_key" ON "StudyPassage"("slug", "version");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPassage_contentHash_key" ON "StudyPassage"("contentHash");

-- CreateIndex
CREATE INDEX "StudySession_userId_status_updatedAt_idx" ON "StudySession"("userId", "status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "StudySession_userId_startedAt_idx" ON "StudySession"("userId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "StudySession_passageId_idx" ON "StudySession"("passageId");

-- CreateIndex
CREATE INDEX "StudySession_goalId_idx" ON "StudySession"("goalId");

-- CreateIndex
CREATE UNIQUE INDEX "StudySession_userId_startKey_key" ON "StudySession"("userId", "startKey");

-- CreateIndex
CREATE INDEX "StudyEvent_userId_createdAt_idx" ON "StudyEvent"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "StudyEvent_sessionId_createdAt_idx" ON "StudyEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "StudyEvent_userId_type_createdAt_idx" ON "StudyEvent"("userId", "type", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "StudyEvent_userId_clientId_key" ON "StudyEvent"("userId", "clientId");

-- AddForeignKey
ALTER TABLE "StudyGoal" ADD CONSTRAINT "StudyGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "StudyGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "StudyPassage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyEvent" ADD CONSTRAINT "StudyEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyEvent" ADD CONSTRAINT "StudyEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Progress, evidence and content boundaries also hold for direct database writes.
ALTER TABLE "StudyGoal" ADD CONSTRAINT "StudyGoal_level_check" CHECK ("level" IN ('CET4', 'CET6'));
ALTER TABLE "StudyGoal" ADD CONSTRAINT "StudyGoal_score_check" CHECK ("targetScore" BETWEEN 220 AND 710 AND "revision" > 0);
ALTER TABLE "StudyPassage" ADD CONSTRAINT "StudyPassage_metadata_check" CHECK ("level" IN ('CET4', 'CET6') AND "kind" IN ('PAST_EXAM', 'OFFICIAL_SAMPLE', 'ORIGINAL') AND "rightsStatus" IN ('PENDING', 'APPROVED', 'REJECTED') AND "version" > 0);
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_progress_check" CHECK ("status" IN ('READING', 'QUESTIONS', 'COMPLETE') AND "sentenceIndex" >= 0 AND "questionIndex" >= 0 AND "activeMs" >= 0 AND "goalRevision" > 0);
ALTER TABLE "StudyEvent" ADD CONSTRAINT "StudyEvent_duration_check" CHECK ("activeMs" BETWEEN 0 AND 900000);

CREATE TABLE "ContributionSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "question" TEXT,
    "publicWordId" TEXT,
    "originalVersion" INTEGER,
    "originalData" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "reason" TEXT,
    "reviewData" TEXT,
    "awardKey" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "reviewToken" TEXT,
    "reviewStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContributionSubmission_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ContributionSubmission_points_check" CHECK ("points" IN (0, 1)),
    CONSTRAINT "ContributionSubmission_kind_check" CHECK ("kind" IN ('NEW', 'CORRECTION'))
);
CREATE UNIQUE INDEX "ContributionSubmission_awardKey_key" ON "ContributionSubmission"("awardKey");
CREATE INDEX "ContributionSubmission_userId_createdAt_idx" ON "ContributionSubmission"("userId", "createdAt");
CREATE INDEX "ContributionSubmission_kind_status_idx" ON "ContributionSubmission"("kind", "status");
ALTER TABLE "ContributionSubmission" ADD CONSTRAINT "ContributionSubmission_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContributionSubmission" ADD CONSTRAINT "ContributionSubmission_publicWordId_fkey"
    FOREIGN KEY ("publicWordId") REFERENCES "PublicWord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

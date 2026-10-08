ALTER TABLE "ExamAttempt" ADD COLUMN "practiceTiming" JSONB;
CREATE TABLE "ExamAnalysisRecord" (
  "userId" TEXT NOT NULL,
  "paperKey" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "token" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExamAnalysisRecord_pkey" PRIMARY KEY ("userId", "paperKey"),
  CONSTRAINT "ExamAnalysisRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExamAnalysisRecord_attempts_check" CHECK ("attempts" BETWEEN 0 AND 3)
);

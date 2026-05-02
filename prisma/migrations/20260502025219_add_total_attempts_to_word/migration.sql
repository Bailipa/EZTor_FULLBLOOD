-- AlterTable
ALTER TABLE "Word" ADD COLUMN     "totalAttempts" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Word_totalAttempts_idx" ON "Word"("totalAttempts");

-- Backfill totalAttempts from existing correctCount + incorrectCount
UPDATE "Word" SET "totalAttempts" = "correctCount" + "incorrectCount";

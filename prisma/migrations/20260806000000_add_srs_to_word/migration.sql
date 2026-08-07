-- AlterTable
ALTER TABLE "Word" ADD COLUMN     "dueDate" TIMESTAMP(3);
ALTER TABLE "Word" ADD COLUMN     "intervalDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Word" ADD COLUMN     "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5;
ALTER TABLE "Word" ADD COLUMN     "repetitions" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Word" ADD COLUMN     "lapses" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Word_userId_dueDate_idx" ON "Word"("userId", "dueDate");

-- Backfill: 从未答对的词默认 1 天后到期，方便 SRS 队列生效
UPDATE "Word" SET "dueDate" = NOW() WHERE "totalAttempts" = 0;

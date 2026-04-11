-- AlterTable
ALTER TABLE "TranslationRecord" ADD COLUMN "requestHash" TEXT;

-- CreateIndex
CREATE INDEX "TranslationRecord_requestHash_idx" ON "TranslationRecord"("requestHash");

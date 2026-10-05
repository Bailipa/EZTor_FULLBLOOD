-- Existing receipts represent completed imports and retain their existing counters.
ALTER TABLE "SharedVocabularyImport"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN "processedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "payload" JSONB,
ADD COLUMN "leaseToken" TEXT,
ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
ADD COLUMN "useReserved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "TranslationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "word" TEXT NOT NULL,
    "phonetic" TEXT,
    "pos" TEXT,
    "translation" TEXT NOT NULL,
    "example" TEXT,
    "exampleTranslation" TEXT,
    "isCached" BOOLEAN NOT NULL DEFAULT false,
    "responseTime" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "TranslationRecord_userId_idx" ON "TranslationRecord"("userId");

-- CreateIndex
CREATE INDEX "TranslationRecord_word_idx" ON "TranslationRecord"("word");

-- CreateIndex
CREATE INDEX "TranslationRecord_createdAt_idx" ON "TranslationRecord"("createdAt");

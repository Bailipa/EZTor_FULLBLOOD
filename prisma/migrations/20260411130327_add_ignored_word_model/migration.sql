-- CreateTable
CREATE TABLE "LlmApiProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "quotaRemaining" INTEGER,
    "quotaUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "lastError" TEXT,
    "lastErrorAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IgnoredWord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "word" TEXT NOT NULL,
    "phonetic" TEXT,
    "translation" TEXT NOT NULL,
    "example" TEXT,
    "exampleTranslation" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IgnoredWord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LlmApiProvider_name_key" ON "LlmApiProvider"("name");

-- CreateIndex
CREATE INDEX "LlmApiProvider_isActive_priority_idx" ON "LlmApiProvider"("isActive", "priority");

-- CreateIndex
CREATE INDEX "IgnoredWord_userId_idx" ON "IgnoredWord"("userId");

-- CreateIndex
CREATE INDEX "IgnoredWord_word_idx" ON "IgnoredWord"("word");

-- CreateIndex
CREATE UNIQUE INDEX "IgnoredWord_word_userId_key" ON "IgnoredWord"("word", "userId");

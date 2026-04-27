-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Word" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "word" TEXT NOT NULL,
    "phonetic" TEXT,
    "pos" TEXT,
    "translation" TEXT NOT NULL,
    "example" TEXT,
    "exampleTranslation" TEXT,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'USER',
    "publicWordId" TEXT,
    CONSTRAINT "Word_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Word" ("correctCount", "createdAt", "example", "exampleTranslation", "id", "incorrectCount", "phonetic", "pos", "translation", "updatedAt", "userId", "word") SELECT "correctCount", "createdAt", "example", "exampleTranslation", "id", "incorrectCount", "phonetic", "pos", "translation", "updatedAt", "userId", "word" FROM "Word";
DROP TABLE "Word";
ALTER TABLE "new_Word" RENAME TO "Word";
CREATE INDEX "Word_userId_updatedAt_idx" ON "Word"("userId", "updatedAt" DESC);
CREATE INDEX "Word_userId_word_idx" ON "Word"("userId", "word");
CREATE UNIQUE INDEX "Word_word_userId_key" ON "Word"("word", "userId");
PRAGMA foreign_key_check("Word");
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE INDEX "ReviewGroupWord_reviewGroupId_addedAt_idx" ON "ReviewGroupWord"("reviewGroupId", "addedAt" DESC);

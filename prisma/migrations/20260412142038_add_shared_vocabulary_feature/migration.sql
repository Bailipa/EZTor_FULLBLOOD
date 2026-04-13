-- CreateTable
CREATE TABLE "SharedVocabulary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "shareType" TEXT NOT NULL DEFAULT 'REVIEW_GROUP',
    "reviewGroupId" TEXT NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "wordCount" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "SharedVocabulary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SharedVocabulary_reviewGroupId_fkey" FOREIGN KEY ("reviewGroupId") REFERENCES "ReviewGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SharedVocabularyImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sharedId" TEXT NOT NULL,
    "importerId" TEXT NOT NULL,
    "wordsImported" INTEGER NOT NULL,
    "wordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "targetGroupId" TEXT NOT NULL,
    "skipExisting" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SharedVocabularyImport_sharedId_fkey" FOREIGN KEY ("sharedId") REFERENCES "SharedVocabulary" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SharedVocabularyImport_importerId_fkey" FOREIGN KEY ("importerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedVocabulary_code_key" ON "SharedVocabulary"("code");

-- CreateIndex
CREATE INDEX "SharedVocabulary_code_idx" ON "SharedVocabulary"("code");

-- CreateIndex
CREATE INDEX "SharedVocabulary_userId_idx" ON "SharedVocabulary"("userId");

-- CreateIndex
CREATE INDEX "SharedVocabulary_reviewGroupId_idx" ON "SharedVocabulary"("reviewGroupId");

-- CreateIndex
CREATE INDEX "SharedVocabulary_expiresAt_idx" ON "SharedVocabulary"("expiresAt");

-- CreateIndex
CREATE INDEX "SharedVocabulary_isActive_idx" ON "SharedVocabulary"("isActive");

-- CreateIndex
CREATE INDEX "SharedVocabularyImport_importerId_idx" ON "SharedVocabularyImport"("importerId");

-- CreateIndex
CREATE INDEX "SharedVocabularyImport_sharedId_idx" ON "SharedVocabularyImport"("sharedId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedVocabularyImport_sharedId_importerId_key" ON "SharedVocabularyImport"("sharedId", "importerId");

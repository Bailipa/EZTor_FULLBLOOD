-- CreateTable
CREATE TABLE "DefaultVocabulary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "groupId" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DefaultVocabulary_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReviewGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DefaultVocabulary_code_key" ON "DefaultVocabulary"("code");

-- CreateIndex
CREATE INDEX "DefaultVocabulary_isActive_idx" ON "DefaultVocabulary"("isActive");

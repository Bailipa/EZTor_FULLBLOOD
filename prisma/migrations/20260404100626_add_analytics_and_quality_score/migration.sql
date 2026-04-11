-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DailyStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "dau" INTEGER NOT NULL DEFAULT 0,
    "newUsers" INTEGER NOT NULL DEFAULT 0,
    "translations" INTEGER NOT NULL DEFAULT 0,
    "dictations" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PublicWord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "word" TEXT NOT NULL,
    "phonetic" TEXT,
    "pos" TEXT,
    "translation" TEXT NOT NULL,
    "example" TEXT,
    "exampleTranslation" TEXT,
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PublicWord" ("createdAt", "example", "exampleTranslation", "id", "phonetic", "pos", "translation", "updatedAt", "word") SELECT "createdAt", "example", "exampleTranslation", "id", "phonetic", "pos", "translation", "updatedAt", "word" FROM "PublicWord";
DROP TABLE "PublicWord";
ALTER TABLE "new_PublicWord" RENAME TO "PublicWord";
CREATE UNIQUE INDEX "PublicWord_word_key" ON "PublicWord"("word");
CREATE INDEX "PublicWord_qualityScore_idx" ON "PublicWord"("qualityScore");
PRAGMA foreign_key_check("PublicWord");
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_idx" ON "AnalyticsEvent"("eventType");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStats_date_key" ON "DailyStats"("date");

-- CreateIndex
CREATE INDEX "DailyStats_date_idx" ON "DailyStats"("date");

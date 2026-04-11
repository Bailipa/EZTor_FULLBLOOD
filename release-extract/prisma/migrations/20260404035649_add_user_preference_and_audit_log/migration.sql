-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "banExpiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Word" (
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
    CONSTRAINT "Word_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReviewGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewGroupWord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewGroupId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewGroupWord_reviewGroupId_fkey" FOREIGN KEY ("reviewGroupId") REFERENCES "ReviewGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewGroupWord_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicWord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "word" TEXT NOT NULL,
    "phonetic" TEXT,
    "pos" TEXT,
    "translation" TEXT NOT NULL,
    "example" TEXT,
    "exampleTranslation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApiConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "apiKey" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1/chat/completions',
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "systemPrompt" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SecurityViolation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "violationType" TEXT NOT NULL,
    "inputValue" TEXT NOT NULL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "SecurityViolation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IpBan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ipAddress" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "violationCount" INTEGER NOT NULL DEFAULT 1,
    "bannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "isPermanent" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "defaultShowPos" BOOLEAN NOT NULL DEFAULT true,
    "defaultShowExample" BOOLEAN NOT NULL DEFAULT true,
    "defaultShowPhonetic" BOOLEAN NOT NULL DEFAULT true,
    "dailyGoal" INTEGER NOT NULL DEFAULT 20,
    "reviewReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reviewReminderTime" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "language" TEXT NOT NULL DEFAULT 'zh-CN',
    "danmakuEnabled" BOOLEAN NOT NULL DEFAULT false,
    "danmakuSpeed" REAL NOT NULL DEFAULT 1.0,
    "danmakuOpacity" REAL NOT NULL DEFAULT 0.7,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Word_word_userId_key" ON "Word"("word", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewGroup_name_userId_key" ON "ReviewGroup"("name", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewGroupWord_reviewGroupId_wordId_key" ON "ReviewGroupWord"("reviewGroupId", "wordId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWord_word_key" ON "PublicWord"("word");

-- CreateIndex
CREATE INDEX "SecurityViolation_userId_idx" ON "SecurityViolation"("userId");

-- CreateIndex
CREATE INDEX "SecurityViolation_detectedAt_idx" ON "SecurityViolation"("detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IpBan_ipAddress_key" ON "IpBan"("ipAddress");

-- CreateIndex
CREATE INDEX "IpBan_ipAddress_idx" ON "IpBan"("ipAddress");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

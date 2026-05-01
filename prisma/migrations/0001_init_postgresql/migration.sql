-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "apiKey" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1/chat/completions',
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "systemPrompt" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStats" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dau" INTEGER NOT NULL DEFAULT 0,
    "newUsers" INTEGER NOT NULL DEFAULT 0,
    "translations" INTEGER NOT NULL DEFAULT 0,
    "dictations" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefaultVocabulary" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "groupId" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DefaultVocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IgnoredWord" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "phonetic" TEXT,
    "translation" TEXT NOT NULL,
    "example" TEXT,
    "exampleTranslation" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IgnoredWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpBan" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "violationCount" INTEGER NOT NULL DEFAULT 1,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isPermanent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IpBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmApiProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "quotaRemaining" INTEGER,
    "quotaUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmApiProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicWord" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "phonetic" TEXT,
    "pos" TEXT,
    "translation" TEXT NOT NULL,
    "example" TEXT,
    "exampleTranslation" TEXT,
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewGroupWord" (
    "id" TEXT NOT NULL,
    "reviewGroupId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewGroupWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityViolation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "violationType" TEXT NOT NULL,
    "inputValue" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "SecurityViolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedVocabulary" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "shareType" TEXT NOT NULL DEFAULT 'REVIEW_GROUP',
    "reviewGroupId" TEXT NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "wordCount" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SharedVocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedVocabularyImport" (
    "id" TEXT NOT NULL,
    "sharedId" TEXT NOT NULL,
    "importerId" TEXT NOT NULL,
    "wordsImported" INTEGER NOT NULL,
    "wordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "targetGroupId" TEXT NOT NULL,
    "skipExisting" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedVocabularyImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslateOnlyUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranslateOnlyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceUsageLog" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslationRecord" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestHash" TEXT,

    CONSTRAINT "TranslationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "banExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
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
    "danmakuSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "danmakuOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Word" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "phonetic" TEXT,
    "pos" TEXT,
    "translation" TEXT,
    "example" TEXT,
    "exampleTranslation" TEXT,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'USER',
    "publicWordId" TEXT,

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "title" TEXT NOT NULL DEFAULT 'Support EZTor',
    "description" TEXT,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_idx" ON "AnalyticsEvent"("eventType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStats_date_key" ON "DailyStats"("date");

-- CreateIndex
CREATE INDEX "DailyStats_date_idx" ON "DailyStats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DefaultVocabulary_code_key" ON "DefaultVocabulary"("code");

-- CreateIndex
CREATE INDEX "DefaultVocabulary_isActive_idx" ON "DefaultVocabulary"("isActive");

-- CreateIndex
CREATE INDEX "IgnoredWord_word_idx" ON "IgnoredWord"("word");

-- CreateIndex
CREATE INDEX "IgnoredWord_userId_idx" ON "IgnoredWord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IgnoredWord_word_userId_key" ON "IgnoredWord"("word", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "IpBan_ipAddress_key" ON "IpBan"("ipAddress");

-- CreateIndex
CREATE INDEX "IpBan_ipAddress_idx" ON "IpBan"("ipAddress");

-- CreateIndex
CREATE UNIQUE INDEX "LlmApiProvider_name_key" ON "LlmApiProvider"("name");

-- CreateIndex
CREATE INDEX "LlmApiProvider_isActive_priority_idx" ON "LlmApiProvider"("isActive", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWord_word_key" ON "PublicWord"("word");

-- CreateIndex
CREATE INDEX "PublicWord_qualityScore_idx" ON "PublicWord"("qualityScore");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewGroup_name_userId_key" ON "ReviewGroup"("name", "userId");

-- CreateIndex
CREATE INDEX "ReviewGroupWord_reviewGroupId_addedAt_idx" ON "ReviewGroupWord"("reviewGroupId", "addedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewGroupWord_reviewGroupId_wordId_key" ON "ReviewGroupWord"("reviewGroupId", "wordId");

-- CreateIndex
CREATE INDEX "SecurityViolation_detectedAt_idx" ON "SecurityViolation"("detectedAt");

-- CreateIndex
CREATE INDEX "SecurityViolation_userId_idx" ON "SecurityViolation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedVocabulary_code_key" ON "SharedVocabulary"("code");

-- CreateIndex
CREATE INDEX "SharedVocabulary_isActive_idx" ON "SharedVocabulary"("isActive");

-- CreateIndex
CREATE INDEX "SharedVocabulary_expiresAt_idx" ON "SharedVocabulary"("expiresAt");

-- CreateIndex
CREATE INDEX "SharedVocabulary_reviewGroupId_idx" ON "SharedVocabulary"("reviewGroupId");

-- CreateIndex
CREATE INDEX "SharedVocabulary_userId_idx" ON "SharedVocabulary"("userId");

-- CreateIndex
CREATE INDEX "SharedVocabulary_code_idx" ON "SharedVocabulary"("code");

-- CreateIndex
CREATE INDEX "SharedVocabularyImport_sharedId_idx" ON "SharedVocabularyImport"("sharedId");

-- CreateIndex
CREATE INDEX "SharedVocabularyImport_importerId_idx" ON "SharedVocabularyImport"("importerId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedVocabularyImport_sharedId_importerId_key" ON "SharedVocabularyImport"("sharedId", "importerId");

-- CreateIndex
CREATE INDEX "TranslateOnlyUsage_date_idx" ON "TranslateOnlyUsage"("date");

-- CreateIndex
CREATE UNIQUE INDEX "TranslateOnlyUsage_userId_date_key" ON "TranslateOnlyUsage"("userId", "date");

-- CreateIndex
CREATE INDEX "DeviceUsageLog_deviceId_date_idx" ON "DeviceUsageLog"("deviceId", "date");

-- CreateIndex
CREATE INDEX "DeviceUsageLog_date_idx" ON "DeviceUsageLog"("date");

-- CreateIndex
CREATE INDEX "TranslationRecord_requestHash_idx" ON "TranslationRecord"("requestHash");

-- CreateIndex
CREATE INDEX "TranslationRecord_createdAt_idx" ON "TranslationRecord"("createdAt");

-- CreateIndex
CREATE INDEX "TranslationRecord_word_idx" ON "TranslationRecord"("word");

-- CreateIndex
CREATE INDEX "TranslationRecord_userId_idx" ON "TranslationRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "Word_userId_word_idx" ON "Word"("userId", "word");

-- CreateIndex
CREATE INDEX "Word_publicWordId_idx" ON "Word"("publicWordId");

-- CreateIndex
CREATE INDEX "Word_userId_updatedAt_idx" ON "Word"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Word_word_userId_key" ON "Word"("word", "userId");

-- AddForeignKey
ALTER TABLE "DefaultVocabulary" ADD CONSTRAINT "DefaultVocabulary_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReviewGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IgnoredWord" ADD CONSTRAINT "IgnoredWord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewGroup" ADD CONSTRAINT "ReviewGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewGroupWord" ADD CONSTRAINT "ReviewGroupWord_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewGroupWord" ADD CONSTRAINT "ReviewGroupWord_reviewGroupId_fkey" FOREIGN KEY ("reviewGroupId") REFERENCES "ReviewGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityViolation" ADD CONSTRAINT "SecurityViolation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedVocabulary" ADD CONSTRAINT "SharedVocabulary_reviewGroupId_fkey" FOREIGN KEY ("reviewGroupId") REFERENCES "ReviewGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedVocabulary" ADD CONSTRAINT "SharedVocabulary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedVocabularyImport" ADD CONSTRAINT "SharedVocabularyImport_importerId_fkey" FOREIGN KEY ("importerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedVocabularyImport" ADD CONSTRAINT "SharedVocabularyImport_sharedId_fkey" FOREIGN KEY ("sharedId") REFERENCES "SharedVocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranslateOnlyUsage" ADD CONSTRAINT "TranslateOnlyUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Word" ADD CONSTRAINT "Word_publicWordId_fkey" FOREIGN KEY ("publicWordId") REFERENCES "PublicWord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Word" ADD CONSTRAINT "Word_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


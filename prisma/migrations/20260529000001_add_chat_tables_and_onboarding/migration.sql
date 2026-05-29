-- AlterTable: Add onboardingCompleted to User table
ALTER TABLE "User" ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: ChatMessage
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isRisky" BOOLEAN NOT NULL DEFAULT false,
    "riskAnalysis" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ChatBan
CREATE TABLE "ChatBan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bannedBy" TEXT NOT NULL,

    CONSTRAINT "ChatBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ChatConfig
CREATE TABLE "ChatConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "featureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isCircuitBroken" BOOLEAN NOT NULL DEFAULT false,
    "circuitBreakReason" TEXT,
    "circuitBreakType" TEXT,
    "circuitBreakAt" TIMESTAMP(3),
    "apiFailureCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminTodo
CREATE TABLE "AdminTodo" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminTodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CustomProfanity
CREATE TABLE "CustomProfanity" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomProfanity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: ChatMessage indexes
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt" DESC);
CREATE INDEX "ChatMessage_userId_idx" ON "ChatMessage"("userId");
CREATE INDEX "ChatMessage_isHidden_idx" ON "ChatMessage"("isHidden");
CREATE INDEX "ChatMessage_isDeleted_idx" ON "ChatMessage"("isDeleted");
CREATE INDEX "ChatMessage_isRisky_idx" ON "ChatMessage"("isRisky");

-- CreateIndex: ChatBan unique constraint
CREATE UNIQUE INDEX "ChatBan_userId_key" ON "ChatBan"("userId");

-- CreateIndex: AdminTodo index
CREATE INDEX "AdminTodo_sortOrder_idx" ON "AdminTodo"("sortOrder");

-- CreateIndex: CustomProfanity unique constraint
CREATE UNIQUE INDEX "CustomProfanity_word_key" ON "CustomProfanity"("word");

-- AddForeignKey: ChatMessage to User
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ChatBan to User
ALTER TABLE "ChatBan" ADD CONSTRAINT "ChatBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

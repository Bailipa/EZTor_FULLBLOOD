-- AI 询问记录（含提问内容，截断保存；用于后台统计/审计）
CREATE TABLE "AiAskLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "isAiFree" BOOLEAN NOT NULL DEFAULT false,
    "turns" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAskLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiAskLog_userId_createdAt_idx" ON "AiAskLog"("userId", "createdAt");
CREATE INDEX "AiAskLog_createdAt_idx" ON "AiAskLog"("createdAt");

ALTER TABLE "AiAskLog" ADD CONSTRAINT "AiAskLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

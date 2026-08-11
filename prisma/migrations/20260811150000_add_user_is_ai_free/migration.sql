-- AI 询问功能：标记用户为 AI 免费（不扣学力）
ALTER TABLE "User" ADD COLUMN "isAiFree" BOOLEAN NOT NULL DEFAULT false;

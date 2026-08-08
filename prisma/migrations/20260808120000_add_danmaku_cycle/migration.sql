-- AlterTable: 弹幕系统性遍历全库（每词记录最近展示轮次）
ALTER TABLE "User" ADD COLUMN "danmakuCycle" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Word" ADD COLUMN "danmakuCycle" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex: 加速"未展示过的词"池查询
CREATE INDEX "Word_userId_danmakuCycle_idx" ON "Word"("userId", "danmakuCycle");

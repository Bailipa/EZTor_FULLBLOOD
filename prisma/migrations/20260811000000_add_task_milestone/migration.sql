-- 闪卡里程碑任务：DailyTaskCompletion 记录下一个待发奖的里程碑下标
ALTER TABLE "DailyTaskCompletion" ADD COLUMN "milestoneIndex" INTEGER NOT NULL DEFAULT 0;

-- 每日学力上限 100 -> 160（闪卡改为里程碑奖励后总和超 100）
ALTER TABLE "UserGameProfile" ALTER COLUMN "dailyPowerCap" SET DEFAULT 160;
UPDATE "UserGameProfile" SET "dailyPowerCap" = 160 WHERE "dailyPowerCap" = 100;

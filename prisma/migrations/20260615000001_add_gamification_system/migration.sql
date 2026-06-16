-- CreateTable
CREATE TABLE "UserGameProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT,
    "combatPower" INTEGER NOT NULL DEFAULT 0,
    "monthlyPower" INTEGER NOT NULL DEFAULT 0,
    "weeklyPower" INTEGER NOT NULL DEFAULT 0,
    "dailyPowerGained" INTEGER NOT NULL DEFAULT 0,
    "dailyPowerCap" INTEGER NOT NULL DEFAULT 100,
    "dailyPowerDate" TEXT NOT NULL DEFAULT '',
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TEXT,
    "nicknameChangedAt" TIMESTAMP(3),
    "unlockedFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "zoneId" TEXT,
    "lastWeeklyReset" TIMESTAMP(3),
    "lastMonthlyReset" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGameProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTaskCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "powerReward" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTaskCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "maxMembers" INTEGER NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "resetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarZone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserGameProfile_userId_key" ON "UserGameProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGameProfile_nickname_key" ON "UserGameProfile"("nickname");

-- CreateIndex
CREATE INDEX "UserGameProfile_combatPower_idx" ON "UserGameProfile"("combatPower" DESC);

-- CreateIndex
CREATE INDEX "UserGameProfile_monthlyPower_idx" ON "UserGameProfile"("monthlyPower" DESC);

-- CreateIndex
CREATE INDEX "UserGameProfile_weeklyPower_idx" ON "UserGameProfile"("weeklyPower" DESC);

-- CreateIndex
CREATE INDEX "UserGameProfile_zoneId_idx" ON "UserGameProfile"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTaskCompletion_userId_date_taskType_key" ON "DailyTaskCompletion"("userId", "date", "taskType");

-- CreateIndex
CREATE INDEX "DailyTaskCompletion_userId_date_idx" ON "DailyTaskCompletion"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WarZone_name_key" ON "WarZone"("name");

-- CreateIndex
CREATE INDEX "WarZone_isActive_idx" ON "WarZone"("isActive");

-- AddForeignKey
ALTER TABLE "UserGameProfile" ADD CONSTRAINT "UserGameProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameProfile" ADD CONSTRAINT "UserGameProfile_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WarZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTaskCompletion" ADD CONSTRAINT "DailyTaskCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

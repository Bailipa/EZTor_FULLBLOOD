PRAGMA foreign_keys=OFF;

-- CreateTable
CREATE TABLE "TranslateOnlyUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TranslateOnlyUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeviceUsageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "TranslateOnlyUsage_date_idx" ON "TranslateOnlyUsage"("date");

-- CreateIndex
CREATE UNIQUE INDEX "TranslateOnlyUsage_userId_date_key" ON "TranslateOnlyUsage"("userId", "date");

-- CreateIndex
CREATE INDEX "DeviceUsageLog_deviceId_date_idx" ON "DeviceUsageLog"("deviceId", "date");

-- CreateIndex
CREATE INDEX "DeviceUsageLog_date_idx" ON "DeviceUsageLog"("date");

PRAGMA foreign_keys=ON;

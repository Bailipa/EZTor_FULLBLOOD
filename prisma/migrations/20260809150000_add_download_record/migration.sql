-- CreateTable: 下载记录（按文件名解析平台/版本）
CREATE TABLE "DownloadRecord" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "version" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DownloadRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DownloadRecord_createdAt_idx" ON "DownloadRecord"("createdAt");
CREATE INDEX "DownloadRecord_fileName_idx" ON "DownloadRecord"("fileName");
CREATE INDEX "DownloadRecord_platform_idx" ON "DownloadRecord"("platform");

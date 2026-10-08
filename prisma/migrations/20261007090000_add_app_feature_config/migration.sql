CREATE TABLE "AppFeatureConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "leaderboardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppFeatureConfig_pkey" PRIMARY KEY ("id")
);

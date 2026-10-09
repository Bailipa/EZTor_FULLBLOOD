CREATE TABLE "RateLimitWindow" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "resetTime" BIGINT NOT NULL,
  CONSTRAINT "RateLimitWindow_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "RateLimitWindow_count_check" CHECK ("count" >= 1)
);
CREATE INDEX "RateLimitWindow_resetTime_idx" ON "RateLimitWindow"("resetTime");

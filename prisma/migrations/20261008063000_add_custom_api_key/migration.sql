CREATE TABLE "CustomApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomApiKey_userId_key" ON "CustomApiKey"("userId");

ALTER TABLE "CustomApiKey" ADD CONSTRAINT "CustomApiKey_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

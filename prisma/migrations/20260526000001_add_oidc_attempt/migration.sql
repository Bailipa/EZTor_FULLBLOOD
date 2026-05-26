-- CreateTable
CREATE TABLE "OidcAttempt" (
    "state" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "redirectTo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OidcAttempt_pkey" PRIMARY KEY ("state")
);

-- CreateIndex
CREATE INDEX "OidcAttempt_createdAt_idx" ON "OidcAttempt"("createdAt");

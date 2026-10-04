CREATE TABLE "ContributionLedger" (
    "id" TEXT NOT NULL,
    "normalizedWordKey" TEXT NOT NULL,
    "publicWordId" TEXT,
    "contributorUserId" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContributionLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContributionLedger_normalizedWordKey_key"
ON "ContributionLedger"("normalizedWordKey");
CREATE INDEX "ContributionLedger_contributorUserId_status_occurredAt_idx"
ON "ContributionLedger"("contributorUserId", "status", "occurredAt");
CREATE INDEX "ContributionLedger_source_status_occurredAt_idx"
ON "ContributionLedger"("source", "status", "occurredAt");

ALTER TABLE "ContributionLedger"
ADD CONSTRAINT "ContributionLedger_publicWordId_fkey"
FOREIGN KEY ("publicWordId") REFERENCES "PublicWord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContributionLedger"
ADD CONSTRAINT "ContributionLedger_contributorUserId_fkey"
FOREIGN KEY ("contributorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ContributionProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "publicAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContributionProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContributionProfile_userId_key" ON "ContributionProfile"("userId");
CREATE UNIQUE INDEX "ContributionProfile_publicAlias_key" ON "ContributionProfile"("publicAlias");
CREATE INDEX "ContributionProfile_visibility_idx" ON "ContributionProfile"("visibility");

ALTER TABLE "ContributionProfile"
ADD CONSTRAINT "ContributionProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve every existing normalized word key as non-attributable history. This prevents
-- deleting and recreating an old public word from creating a new personal contribution.
INSERT INTO "ContributionLedger" (
    "id", "normalizedWordKey", "publicWordId", "contributorUserId", "source", "status",
    "occurredAt", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    legacy."normalizedWordKey",
    legacy."id",
    NULL,
    'LEGACY_UNKNOWN',
    'VALID',
    legacy."createdAt",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON (lower(btrim("word")))
        "id",
        lower(btrim("word")) AS "normalizedWordKey",
        "createdAt"
    FROM "PublicWord"
    WHERE btrim("word") <> ''
    ORDER BY lower(btrim("word")), "createdAt" ASC, "id" ASC
) AS legacy;

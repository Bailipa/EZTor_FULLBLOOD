-- AlterTable
ALTER TABLE "UserGameProfile" ADD COLUMN "lastZoneTransferAt" TIMESTAMP(3);
ALTER TABLE "UserGameProfile" ADD COLUMN "zoneTitle" VARCHAR(6);
ALTER TABLE "UserGameProfile" ADD COLUMN "lastZoneTitleChangeAt" TIMESTAMP(3);

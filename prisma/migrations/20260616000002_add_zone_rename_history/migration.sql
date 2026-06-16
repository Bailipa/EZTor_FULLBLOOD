-- AlterTable
ALTER TABLE "WarZone" ADD COLUMN "previousName" TEXT;
ALTER TABLE "WarZone" ADD COLUMN "renamedBy" TEXT;
ALTER TABLE "WarZone" ADD COLUMN "renamedAt" TIMESTAMP(3);

-- AlterTable: Add isSystem to ReviewGroup table
ALTER TABLE "ReviewGroup" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

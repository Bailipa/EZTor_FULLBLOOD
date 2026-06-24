-- Lower default WarZone maxMembers from 50 to 15
ALTER TABLE "WarZone" ALTER COLUMN "maxMembers" SET DEFAULT 15;
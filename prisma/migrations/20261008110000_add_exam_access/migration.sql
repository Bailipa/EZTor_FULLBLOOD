BEGIN;
-- Hold registration until the existing-account snapshot has been backfilled.
LOCK TABLE "User" IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE "ExamAccess" (
  "userId" TEXT NOT NULL,
  "paperKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExamAccess_pkey" PRIMARY KEY ("userId", "paperKey"),
  CONSTRAINT "ExamAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- No default grant: only accounts and approved papers already present get access.
INSERT INTO "ExamAccess" ("userId", "paperKey")
SELECT u.id, p.key FROM "User" u CROSS JOIN (
  SELECT DISTINCT regexp_replace(slug, '-(passage[0-9]+(-q[0-9]+-[0-9]+)?|full|listening)$', '') AS key
  FROM "ExamPaper" WHERE "rightsStatus" = 'APPROVED'
  UNION
  SELECT DISTINCT regexp_replace(slug, '-(passage[0-9]+(-q[0-9]+-[0-9]+)?|full|listening)$', '') AS key
  FROM "StudyPassage" WHERE "rightsStatus" = 'APPROVED'
) p;
COMMIT;

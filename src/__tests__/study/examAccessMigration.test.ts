import { describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
const url = process.env.EXAM_TEST_DATABASE_URL
if (url) {
  const parsed = new URL(url)
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !/^\/eztor_exam_test_\d+$/.test(parsed.pathname)) throw new Error('Migration checks require an isolated local database')
}
describe.skipIf(!url)('Exam access migration', () => {
  it('backfills existing accounts once, with no grants for later accounts or later papers', async () => {
    const client = new Client({ connectionString: url })
    await client.connect()
    const schema = `access_migration_${Date.now()}`
    try {
      await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`)
      await client.query(`CREATE TABLE "User" (id TEXT PRIMARY KEY);
        CREATE TABLE "ExamPaper" (slug TEXT, "rightsStatus" TEXT);
        CREATE TABLE "StudyPassage" (slug TEXT, "rightsStatus" TEXT);
        INSERT INTO "User" VALUES ('old-a'),('old-b');
        INSERT INTO "ExamPaper" VALUES ('cet4-2024-06-set1-full','APPROVED'),('cet4-2024-06-set1-listening','APPROVED'),('pending-full','PENDING');
        INSERT INTO "StudyPassage" VALUES ('cet6-2024-12-set1-passage1-q1-5','APPROVED');`)
      await client.query(await readFile('prisma/migrations/20261008110000_add_exam_access/migration.sql', 'utf8'))
      expect((await client.query('SELECT "userId", "paperKey" FROM "ExamAccess" ORDER BY 1,2')).rows).toEqual([
        { userId: 'old-a', paperKey: 'cet4-2024-06-set1' }, { userId: 'old-a', paperKey: 'cet6-2024-12-set1' },
        { userId: 'old-b', paperKey: 'cet4-2024-06-set1' }, { userId: 'old-b', paperKey: 'cet6-2024-12-set1' },
      ])
      await client.query(`INSERT INTO "User" VALUES ('new-account'); INSERT INTO "ExamPaper" VALUES ('cet4-2025-06-set1-full','APPROVED')`)
      expect((await client.query('SELECT count(*)::int AS count FROM "ExamAccess" WHERE "userId"=$1', ['new-account'])).rows[0].count).toBe(0)
      expect((await client.query('SELECT count(*)::int AS count FROM "ExamAccess" WHERE "paperKey"=$1', ['cet4-2025-06-set1'])).rows[0].count).toBe(0)
    } finally {
      await client.query('ROLLBACK')
      await client.query(`SET search_path TO public; DROP SCHEMA IF EXISTS ${schema} CASCADE`)
      await client.end()
    }
  })
})

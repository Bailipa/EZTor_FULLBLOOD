#!/usr/bin/env node
const { readdir, readFile } = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { PrismaClient } = require('@prisma/client')

async function checkDeployMigrations(root = path.resolve(__dirname, '..')) {
  const db = new PrismaClient()
  try {
    const rows = await db.$queryRaw`
      SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"`
    if (rows.some(row => !row.finished_at && !row.rolled_back_at)) throw new Error('存在未完成的迁移，请先处理迁移状态')
    const applied = new Map(rows.filter(row => row.finished_at && !row.rolled_back_at).map(row => [row.migration_name, row.checksum]))
    const migrations = path.join(root, 'prisma/migrations')
    for (const entry of await readdir(migrations, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const sql = await readFile(path.join(migrations, entry.name, 'migration.sql'))
      if (applied.get(entry.name) !== createHash('sha256').update(sql).digest('hex')) {
        throw new Error(`迁移未应用或校验不一致：${entry.name}`)
      }
    }
    // Also catch accidental schema deletion despite a completed migration record.
    await db.$queryRaw`SELECT key, count, "resetTime" FROM "RateLimitWindow" LIMIT 0`
  } finally {
    await db.$disconnect()
  }
}
module.exports = { checkDeployMigrations }
if (require.main === module) {
  checkDeployMigrations().then(() => console.log('部署迁移检查通过')).catch(() => {
    console.error('部署已阻止：数据库迁移缺失、校验不一致或数据库不可访问。请先备份、应用本发布包迁移，再检查；未输出连接信息。')
    process.exit(1)
  })
}

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import * as fs from 'fs'

const BACKUP_PATH = 'prisma/prisma/dev.db.backup.20260501_160403'
const pg = new PrismaClient()

function _sqliteQuery(sql: string): string {
  return execSync(`sqlite3 "${BACKUP_PATH}" "${sql}"`, { encoding: 'utf8' })
}

function sqliteJSON(sql: string): any[] {
  execSync(`sqlite3 "${BACKUP_PATH}" -json "${sql}" > /tmp/sqlite_export.json`, { encoding: 'utf8' })
  const raw = fs.readFileSync('/tmp/sqlite_export.json', 'utf8')
  if (!raw.trim()) return []
  return JSON.parse(raw)
}

async function main() {
  // 1. Migrate Users
  console.log('Migrating Users...')
  const users = sqliteJSON('SELECT * FROM User')
  for (const u of users) {
    await pg.user.upsert({
      where: { username: u.username },
      update: { isAdmin: !!u.isAdmin, updatedAt: new Date(u.updatedAt || Date.now()) },
      create: {
        id: u.id, username: u.username, password: u.password,
        isAdmin: !!u.isAdmin,
        createdAt: new Date(u.createdAt || Date.now()),
        updatedAt: new Date(u.updatedAt || Date.now()),
      },
    })
  }
  console.log(`  Migrated ${users.length} users`)

  // 2. Migrate PublicWord
  console.log('Migrating PublicWord...')
  const publicWords = sqliteJSON('SELECT * FROM PublicWord')
  for (const pw of publicWords) {
    await pg.publicWord.upsert({
      where: { word: pw.word },
      update: {
        translation: pw.translation, phonetic: pw.phonetic || null,
        pos: pw.pos || null, example: pw.example || null,
        exampleTranslation: pw.exampleTranslation || null,
        qualityScore: pw.qualityScore || 0, version: pw.version || 1,
        updatedAt: new Date(pw.updatedAt || Date.now()),
      },
      create: {
        id: pw.id, word: pw.word, translation: pw.translation || '',
        phonetic: pw.phonetic || null, pos: pw.pos || null,
        example: pw.example || null, exampleTranslation: pw.exampleTranslation || null,
        qualityScore: pw.qualityScore || 0, version: pw.version || 1,
        createdAt: new Date(pw.createdAt || Date.now()),
        updatedAt: new Date(pw.updatedAt || Date.now()),
      },
    })
  }
  console.log(`  Migrated ${publicWords.length} public words`)

  // 3. Migrate Word (user vocab) - individual inserts with error skipping
  console.log('Migrating Word...')
  const words = sqliteJSON('SELECT * FROM Word')
  let wordCount = 0
  let wordErrors = 0
  for (const w of words) {
    try {
      await pg.$executeRawUnsafe(
        `INSERT INTO "Word" (id, word, "userId", phonetic, pos, translation, example, "exampleTranslation", "correctCount", "incorrectCount", "createdAt", "updatedAt", "publicWordId", "sourceType")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT DO NOTHING`,
        w.id, w.word, w.userId,
        w.phonetic || null, w.pos || null, w.translation || null,
        w.example || null, w.exampleTranslation || null,
        w.correctCount || 0, w.incorrectCount || 0,
        new Date(w.createdAt || Date.now()), new Date(w.updatedAt || Date.now()),
        null, w.sourceType || 'USER'  // set publicWordId to null to avoid FK issues
      )
      wordCount++
    } catch (_e: any) {
      wordErrors++
    }
  }
  console.log(`  Migrated ${wordCount} words (${wordErrors} errors)`)

  // 4. Migrate ReviewGroup
  console.log('Migrating ReviewGroup...')
  const groups = sqliteJSON('SELECT * FROM ReviewGroup')
  for (const g of groups) {
    await pg.reviewGroup.upsert({
      where: { id: g.id },
      update: { name: g.name, updatedAt: new Date(g.updatedAt || Date.now()) },
      create: {
        id: g.id, name: g.name, userId: g.userId,
        createdAt: new Date(g.createdAt || Date.now()),
        updatedAt: new Date(g.updatedAt || Date.now()),
      },
    })
  }
  console.log(`  Migrated ${groups.length} review groups`)

  // 5. Migrate ReviewGroupWord
  console.log('Migrating ReviewGroupWord...')
  const rgWords = sqliteJSON('SELECT * FROM ReviewGroupWord')
  for (const r of rgWords) {
    await pg.reviewGroupWord.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id, reviewGroupId: r.reviewGroupId, wordId: r.wordId,
      },
    })
  }
  console.log(`  Migrated ${rgWords.length} group-word links`)

  // 6. Migrate DefaultVocabulary
  console.log('Migrating DefaultVocabulary...')
  const defaults = sqliteJSON('SELECT * FROM DefaultVocabulary')
  for (const d of defaults) {
    await pg.defaultVocabulary.upsert({
      where: { id: d.id },
      update: {
        name: d.name, description: d.description, isActive: !!d.isActive,
        sortOrder: d.sortOrder || 0, wordCount: d.wordCount || 0,
        updatedAt: new Date(d.updatedAt || Date.now()),
      },
      create: {
        id: d.id, name: d.name, code: d.code, description: d.description || null,
        groupId: d.groupId, wordCount: d.wordCount || 0,
        isActive: !!d.isActive, sortOrder: d.sortOrder || 0,
        createdAt: new Date(d.createdAt || Date.now()),
        updatedAt: new Date(d.updatedAt || Date.now()),
      },
    })
  }
  console.log(`  Migrated ${defaults.length} default vocabularies`)

  // 7. Migrate ApiConfig
  console.log('Migrating ApiConfig...')
  const apiConfigs = sqliteJSON('SELECT * FROM ApiConfig')
  for (const c of apiConfigs) {
    const _now = new Date()
    await pg.apiConfig.upsert({
      where: { id: 'global' },
      update: {},
      create: {
        id: 'global', apiKey: c.apiKey || '', baseUrl: c.baseUrl || 'https://api.openai.com/v1/chat/completions',
        model: c.model || 'gpt-4o-mini', systemPrompt: c.systemPrompt || null,
        updatedAt: new Date(c.updatedAt || Date.now()),
      },
    })
  }
  console.log(`  Migrated ${apiConfigs.length} api configs`)

  // 8. Migrate IgnoredWord
  try {
    const ignoredWords = sqliteJSON('SELECT * FROM IgnoredWord')
    for (const iw of ignoredWords) {
      await pg.ignoredWord.upsert({
        where: { id: iw.id },
        update: {},
        create: {
          id: iw.id, userId: iw.userId, word: iw.word, reason: iw.reason || null,
          createdAt: new Date(iw.createdAt || Date.now()),
        },
      })
    }
    console.log(`  Migrated ${ignoredWords.length} ignored words`)
  } catch { console.log('  IgnoredWord table may not exist') }

  // 9. Migrate SharedVocabulary
  try {
    const shares = sqliteJSON('SELECT * FROM SharedVocabulary')
    for (const s of shares) {
      await pg.sharedVocabulary.upsert({
        where: { id: s.id },
        update: { maxUses: s.maxUses, useCount: s.useCount || 0, isActive: !!s.isActive },
        create: {
          id: s.id, code: s.code, name: s.name, description: s.description || null,
          userId: s.userId, shareType: s.shareType || 'GROUP',
          reviewGroupId: s.reviewGroupId, wordCount: s.wordCount || 0,
          maxUses: s.maxUses, useCount: s.useCount || 0,
          expiresAt: s.expiresAt ? new Date(s.expiresAt) : null,
          isActive: !!s.isActive, viewCount: s.viewCount || 0,
          createdAt: new Date(s.createdAt || Date.now()),
          updatedAt: new Date(s.updatedAt || Date.now()),
        },
      })
    }
    console.log(`  Migrated ${shares.length} shared vocabularies`)
  } catch { console.log('  SharedVocabulary table may not exist') }

  // 10. Migrate LlmApiProvider
  try {
    const providers = sqliteJSON('SELECT * FROM LlmApiProvider')
    for (const p of providers) {
      await pg.llmApiProvider.upsert({
        where: { id: p.id },
        update: {},
        create: {
          id: p.id, name: p.name, apiKey: p.apiKey, baseUrl: p.baseUrl || 'https://api.openai.com/v1',
          model: p.model || 'gpt-4o-mini', priority: p.priority || 0,
          isActive: !!p.isActive, quotaRemaining: p.quotaRemaining || null,
          quotaUsed: p.quotaUsed || 0, lastUsedAt: p.lastUsedAt ? new Date(p.lastUsedAt) : null,
          lastError: p.lastError || null, lastErrorAt: p.lastErrorAt ? new Date(p.lastErrorAt) : null,
          createdAt: new Date(p.createdAt || Date.now()),
          updatedAt: new Date(p.updatedAt || Date.now()),
        },
      })
    }
    console.log(`  Migrated ${providers.length} llm providers`)
  } catch { console.log('  LlmApiProvider table may not exist') }

  // 11. Keep existing DonationConfig
  console.log('Preserving DonationConfig...')
  const donConfig = await pg.donationConfig.findUnique({ where: { id: 'global' } })
  console.log(`  DonationConfig: ${donConfig ? 'already exists' : 'needs seeding'}`)

  await pg.$disconnect()
  console.log('\nMigration complete!')
}

main().catch(e => { console.error(e); process.exit(1) })

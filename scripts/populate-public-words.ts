import { PrismaClient } from '@prisma/client'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as csv from 'csv-parse/sync'

const prisma = new PrismaClient()

interface TatoebaPair {
  english: string
  chinese: string
}

function loadTatoebaPairs(filePath: string): Map<string, TatoebaPair[]> {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const wordMap = new Map<string, TatoebaPair[]>()

  for (const line of lines) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    if (parts.length < 2) continue
    const english = parts[0].trim()
    const chinese = parts[1].trim()

    const words = english.toLowerCase().split(/\s+/)
    const uniqueWords = [...new Set(words)]
    for (const w of uniqueWords) {
      if (w.length < 2) continue
      if (!/[a-z]/.test(w)) continue
      if (!wordMap.has(w)) {
        wordMap.set(w, [])
      }
      const arr = wordMap.get(w)!
      if (arr.length < 5) {
        arr.push({ english, chinese })
      }
    }
  }

  return wordMap
}

interface ECDICTEntry {
  word: string
  phonetic: string
  translation: string
  pos: string
  tag: string
}

const TARGET_TAGS = ['cet4', 'cet6', 'ky', 'ielts', 'toefl', 'gre', 'gk', 'zk']

function loadECDICTTagged(filePath: string): Map<string, ECDICTEntry> {
  const content = fs.readFileSync(filePath, 'utf-8')
  const records = csv.parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })

  const result = new Map<string, ECDICTEntry>()
  for (const row of records) {
    const tag = row.tag || ''
    const hasTargetTag = TARGET_TAGS.some((t) => tag.includes(t))
    if (!hasTargetTag) continue

    const word = (row.word || '').trim().toLowerCase()
    if (!word) continue
    if (result.has(word)) continue

    result.set(word, {
      word,
      phonetic: row.phonetic || '',
      translation: row.translation || '',
      pos: row.pos || '',
      tag,
    })
  }
  return result
}

function pickBestExamples(
  word: string,
  tatoebaMap: Map<string, TatoebaPair[]>,
): { example: string; exampleTranslation: string } | null {
  const pairs = tatoebaMap.get(word.toLowerCase())
  if (!pairs || pairs.length === 0) return null

  const scored = pairs.map((p) => {
    const sentenceWords = p.english.toLowerCase().split(/\s+/)
    const wordCount = sentenceWords.length
    const score =
      (wordCount >= 5 && wordCount <= 20 ? 10 : wordCount < 5 ? 3 : 5) +
      (p.english.toLowerCase().includes(word) ? 5 : 0)
    return { pair: p, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0].pair
  return {
    example: best.english,
    exampleTranslation: best.chinese,
  }
}

function cleanTranslation(raw: string): string {
  if (!raw) return ''
  return raw
    .split('\\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
    .join('\n')
}

function getQualityScore(tag: string): number {
  if (tag.includes('cet4')) return 80
  if (tag.includes('cet6')) return 75
  if (tag.includes('ky')) return 85
  if (tag.includes('ielts')) return 70
  if (tag.includes('toefl')) return 70
  if (tag.includes('gre')) return 65
  if (tag.includes('gk')) return 60
  if (tag.includes('zk')) return 55
  return 50
}

async function populatePublicWord(
  ecdictMap: Map<string, ECDICTEntry>,
  tatoebaMap: Map<string, TatoebaPair[]>,
) {
  console.log(`\n📝 Populating PublicWord with ${ecdictMap.size} tagged vocabulary entries...`)

  const existingCount = await prisma.publicWord.count()
  console.log(`  Current PublicWord count: ${existingCount}`)

  const existingWords = new Set<string>()
  if (existingCount > 0) {
    const existing = await prisma.publicWord.findMany({
      select: { word: true },
    })
    for (const w of existing) {
      existingWords.add(w.word.toLowerCase())
    }
    console.log(`  Found ${existingWords.size} existing entries to skip`)
  }

  let imported = 0
  let skipped = 0
  let examplesAdded = 0
  const batchSize = 50
  const entries = Array.from(ecdictMap.values())

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize)
    const creates: Promise<any>[] = []

    for (const entry of batch) {
      const normalizedWord = entry.word.toLowerCase().trim()
      const translation = cleanTranslation(entry.translation)

      if (!translation) {
        skipped++
        continue
      }

      if (existingWords.has(normalizedWord)) {
        skipped++
        continue
      }

      const example = pickBestExamples(normalizedWord, tatoebaMap)
      const qualityScore = getQualityScore(entry.tag)

      creates.push(
        prisma.publicWord
          .create({
            data: {
              id: crypto.randomUUID(),
              word: normalizedWord,
              phonetic: entry.phonetic || null,
              pos: entry.pos || null,
              translation,
              example: example?.example || null,
              exampleTranslation: example?.exampleTranslation || null,
              qualityScore,
              version: 1,
              updatedAt: new Date(),
            },
          })
          .catch((e: any) => {
            if (e.code === 'P2002') {
              skipped++
              return null
            }
            throw e
          }),
      )

      imported++
      if (example) examplesAdded++
    }

    await Promise.all(creates)

    const processed = Math.min(i + batchSize, entries.length)
    if (processed % 500 === 0 || processed === entries.length) {
      console.log(
        `  Progress: ${processed}/${entries.length} (imported: ${imported}, skipped: ${skipped}, examples: ${examplesAdded})`,
      )
    }
  }

  console.log(
    `  ✅ Import complete: ${imported} new, ${skipped} existing, ${examplesAdded} with examples`,
  )

  const finalCount = await prisma.publicWord.count()
  console.log(`  Final PublicWord count: ${finalCount}`)
}

async function main() {
  const ecdictPath = process.argv[2] || '/tmp/ecdict.csv'
  const tatoebaPath = process.argv[3] || '/tmp/cmn.txt'

  if (!fs.existsSync(ecdictPath)) {
    console.error(`❌ ECDICT file not found: ${ecdictPath}`)
    process.exit(1)
  }

  if (!fs.existsSync(tatoebaPath)) {
    console.error(`❌ Tatoeba file not found: ${tatoebaPath}`)
    process.exit(1)
  }

  console.log('📖 Loading Tatoeba sentence pairs...')
  const tatoebaMap = loadTatoebaPairs(tatoebaPath)
  console.log(`  Loaded sentences for ${tatoebaMap.size} unique words`)

  console.log('📖 Loading ECDICT tagged vocabulary...')
  const ecdictMap = loadECDICTTagged(ecdictPath)
  console.log(`  Found ${ecdictMap.size} tagged words (cet4, cet6, ky, ielts, toefl, gre, gk, zk)`)

  await populatePublicWord(ecdictMap, tatoebaMap)

  console.log('\n✅ All done!')

  const totalPublicWords = await prisma.publicWord.count()
  const publicWordsWithExamples = await prisma.publicWord.count({
    where: { example: { not: null } },
  })
  console.log(`📊 PublicWord total: ${totalPublicWords}, with examples: ${publicWordsWithExamples}`)
}

main()
  .catch((e) => {
    console.error('❌ Script failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

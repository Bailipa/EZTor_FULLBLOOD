import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('修复分享词库的 ReviewGroup 单词\n')

  const shares = await prisma.sharedVocabulary.findMany({
    include: {
      ReviewGroup: {
        include: {
          ReviewGroupWord: {
            include: {
              Word: true,
            },
          },
        },
      },
    },
  })

  let totalFixed = 0
  let totalSkipped = 0
  let totalNoTranslation = 0

  for (const share of shares) {
    if (!share.ReviewGroup) continue

    console.log(`\n处理 ${share.code} (${share.name})...`)

    let fixed = 0
    let skipped = 0
    let noTranslation = 0

    for (const rgw of share.ReviewGroup.ReviewGroupWord) {
      const word = rgw.Word
      const normalizedWord = word.word.toLowerCase().trim()

      if (word.sourceType === 'PUBLIC' && word.publicWordId) {
        skipped++
        continue
      }

      const translation = word.translation || ''
      if (!translation.trim()) {
        noTranslation++
        skipped++
        continue
      }

      let publicWordId = word.publicWordId

      if (!publicWordId) {
        const existingPublic = await prisma.publicWord.findUnique({
          where: { word: normalizedWord },
        })

        if (existingPublic) {
          publicWordId = existingPublic.id
        } else {
          try {
            const created = await prisma.publicWord.create({
              data: {
                id: randomUUID(),
                word: normalizedWord,
                translation: translation,
                phonetic: word.phonetic,
                pos: word.pos,
                example: word.example,
                exampleTranslation: word.exampleTranslation,
                updatedAt: new Date(),
              },
            })
            publicWordId = created.id
          } catch (err: any) {
            if (err.code === 'P2002') {
              const pw = await prisma.publicWord.findUnique({ where: { word: normalizedWord } })
              publicWordId = pw?.id || null
            } else {
              console.error(`创建 publicWord 失败 ${word.word}:`, err.message)
              skipped++
              continue
            }
          }
        }
      }

      if (publicWordId) {
        await prisma.word.update({
          where: { id: word.id },
          data: {
            sourceType: 'PUBLIC',
            publicWordId: publicWordId,
            translation: null,
            phonetic: null,
            pos: null,
            example: null,
            exampleTranslation: null,
          },
        })
        fixed++
      } else {
        skipped++
      }
    }

    console.log(`  修复: ${fixed}, 跳过: ${skipped}, 无翻译: ${noTranslation}`)
    totalFixed += fixed
    totalSkipped += skipped
    totalNoTranslation += noTranslation
  }

  console.log(`\n\n总计:`)
  console.log(`  修复: ${totalFixed} 个单词`)
  console.log(`  跳过: ${totalSkipped} 个单词`)
  console.log(`  无翻译(无法处理): ${totalNoTranslation} 个单词`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

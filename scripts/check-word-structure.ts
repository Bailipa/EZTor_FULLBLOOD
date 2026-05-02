import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('检查 creator 词库中的单词是否正确设置了 publicWordId\n')

  const creator = await prisma.user.findUnique({
    where: { username: 'creator' },
  })

  if (!creator) {
    console.log('用户 creator 不存在')
    return
  }

  const words = await prisma.word.findMany({
    where: { userId: creator.id },
    take: 20,
    select: {
      id: true,
      word: true,
      translation: true,
      sourceType: true,
      publicWordId: true,
      publicWord: {
        select: {
          id: true,
          translation: true,
        },
      },
    },
  })

  console.log(`creator 的前 20 个单词:\n`)
  for (const w of words) {
    console.log(`  ${w.word}:`)
    console.log(`    translation: ${w.translation || '(null)'}`)
    console.log(`    sourceType: ${w.sourceType}`)
    console.log(`    publicWordId: ${w.publicWordId || '(null)'}`)
    console.log(`    publicWord.translation: ${w.publicWord?.translation || '(null/undefined)'}`)
    console.log()
  }

  const withoutPublicWordId = await prisma.word.count({
    where: {
      userId: creator.id,
      sourceType: 'PUBLIC',
      publicWordId: null,
    },
  })

  const withPublicWordId = await prisma.word.count({
    where: {
      userId: creator.id,
      sourceType: 'PUBLIC',
      NOT: { publicWordId: null },
    },
  })

  const userSourceType = await prisma.word.count({
    where: {
      userId: creator.id,
      sourceType: 'USER',
    },
  })

  console.log(`统计:`)
  console.log(`  sourceType=PUBLIC 且 publicWordId=null: ${withoutPublicWordId}`)
  console.log(`  sourceType=PUBLIC 且 publicWordId!=null: ${withPublicWordId}`)
  console.log(`  sourceType=USER: ${userSourceType}`)

  console.log('\n检查分享词库的源单词状态 (以 XY3-HPV-FFU 为例):')
  const share = await prisma.sharedVocabulary.findUnique({
    where: { code: 'XY3-HPV-FFU' },
    include: {
      ReviewGroup: {
        include: {
          ReviewGroupWord: {
            take: 5,
            include: {
              Word: {
                select: {
                  word: true,
                  translation: true,
                  sourceType: true,
                  publicWordId: true,
                  publicWord: {
                    select: { id: true, translation: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (share) {
    console.log(`\n分享 "${share.name}" 的前 5 个单词:\n`)
    for (const rgw of share.ReviewGroup.ReviewGroupWord) {
      const w = rgw.Word
      console.log(`  ${w.word}:`)
      console.log(`    translation: ${w.translation || '(null)'}`)
      console.log(`    sourceType: ${w.sourceType}`)
      console.log(`    publicWordId: ${w.publicWordId || '(null)'}`)
      console.log(
        `    publicWord: ${w.publicWord ? `存在 (translation: ${w.publicWord.translation?.slice(0, 30)}...)` : '(null)'}`,
      )
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

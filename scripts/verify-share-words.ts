import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('验证分享词库 XY3-HPV-FFU 的单词状态\n');

  const share = await prisma.sharedVocabulary.findUnique({
    where: { code: 'XY3-HPV-FFU' },
    include: {
      ReviewGroup: {
        include: {
          ReviewGroupWord: {
            take: 10,
            include: {
              Word: {
                select: {
                  word: true,
                  translation: true,
                  sourceType: true,
                  publicWordId: true,
                  publicWord: {
                    select: { id: true, translation: true }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (share) {
    console.log(`分享 "${share.name}" 的前 10 个单词:\n`);
    for (const rgw of share.ReviewGroup.ReviewGroupWord) {
      const w = rgw.Word;
      console.log(`  ${w.word}:`);
      console.log(`    translation: ${w.translation || '(null)'}`);
      console.log(`    sourceType: ${w.sourceType}`);
      console.log(`    publicWordId: ${w.publicWordId || '(null)'}`);
      console.log(`    publicWord: ${w.publicWord ? `存在 (translation: ${w.publicWord.translation?.slice(0, 30)}...)` : '(null)'}`);
    }

    const withoutPublicWord = share.ReviewGroup.ReviewGroupWord.filter(
      rgw => !rgw.Word.publicWordId || !rgw.Word.publicWord
    );

    console.log(`\n统计: 前 10 个单词中有 ${withoutPublicWord.length} 个没有正确的 publicWord`);
  }

  console.log('\n\n检查所有分享词库的单词状态:\n');
  const shares = await prisma.sharedVocabulary.findMany({
    include: {
      ReviewGroup: {
        include: {
          ReviewGroupWord: {
            include: {
              Word: {
                select: {
                  publicWordId: true,
                  publicWord: true
                }
              }
            }
          }
        }
      }
    }
  });

  for (const s of shares) {
    const total = s.ReviewGroup?.ReviewGroupWord?.length || 0;
    const withoutPublic = s.ReviewGroup?.ReviewGroupWord?.filter(
      rgw => !rgw.Word.publicWordId || !rgw.Word.publicWord
    ).length || 0;

    console.log(`  ${s.code} (${s.name}): ${total} 个单词, ${withoutPublic} 个缺少 publicWord`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

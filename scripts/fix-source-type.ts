import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('修复剩余的 sourceType=USER 但有 publicWordId 的单词\n');

  const creator = await prisma.user.findUnique({
    where: { username: 'creator' }
  });

  if (!creator) {
    console.log('用户 creator 不存在');
    return;
  }

  const wordsWithPublicWordId = await prisma.word.findMany({
    where: {
      userId: creator.id,
      sourceType: 'USER',
      NOT: { publicWordId: null }
    },
    select: {
      id: true,
      word: true,
      translation: true,
      publicWordId: true
    }
  });

  console.log(`找到 ${wordsWithPublicWordId.length} 个有 publicWordId 但 sourceType=USER 的单词\n`);

  let fixed = 0;
  for (const word of wordsWithPublicWordId) {
    try {
      await prisma.word.update({
        where: { id: word.id },
        data: {
          sourceType: 'PUBLIC',
          translation: null,
          phonetic: null,
          pos: null,
          example: null,
          exampleTranslation: null
        }
      });
      fixed++;
    } catch (err) {
      console.error(`修复单词 ${word.word} 失败:`, err instanceof Error ? err.message : String(err));
    }
  }

  console.log(`完成! 共修复 ${fixed} 个单词`);

  const wordsWithoutTranslation = await prisma.word.count({
    where: {
      userId: creator.id,
      sourceType: 'USER',
      publicWordId: null,
      translation: null
    }
  });

  console.log(`\n剩余无 translation、无 publicWordId 的 sourceType=USER 单词: ${wordsWithoutTranslation} 个`);

  const finalStats = await prisma.word.groupBy({
    by: ['sourceType'],
    where: { userId: creator.id },
    _count: true
  });

  console.log('\ncreator 最终单词统计:');
  for (const s of finalStats) {
    console.log(`  sourceType=${s.sourceType}: ${s._count} 个`);
  }

  const nullPublicWordId = await prisma.word.count({
    where: {
      userId: creator.id,
      sourceType: 'PUBLIC',
      publicWordId: null
    }
  });
  console.log(`  sourceType=PUBLIC 且 publicWordId=null: ${nullPublicWordId} 个`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

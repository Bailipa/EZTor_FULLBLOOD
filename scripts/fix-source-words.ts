import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('修复分享词库源单词的 publicWordId 问题\n');

  const creator = await prisma.user.findUnique({
    where: { username: 'creator' }
  });

  if (!creator) {
    console.log('用户 creator 不存在');
    return;
  }

  const problemWords = await prisma.word.findMany({
    where: {
      userId: creator.id,
      sourceType: 'USER',
      OR: [
        { publicWordId: null },
        { translation: { not: null } }
      ]
    },
    select: {
      id: true,
      word: true,
      translation: true,
      phonetic: true,
      pos: true,
      example: true,
      exampleTranslation: true,
      sourceType: true,
      publicWordId: true
    }
  });

  console.log(`找到 ${problemWords.length} 个需要修复的单词\n`);

  let fixed = 0;
  let skipped = 0;

  for (const word of problemWords) {
    try {
      const normalizedWord = word.word.toLowerCase().trim();

      if (word.publicWordId) {
        skipped++;
        continue;
      }

      const translation = word.translation || '';
      if (!translation.trim()) {
        skipped++;
        continue;
      }

      let publicWordId = word.publicWordId;

      if (!publicWordId) {
        const existingPublic = await prisma.publicWord.findUnique({
          where: { word: normalizedWord }
        });

        if (existingPublic) {
          publicWordId = existingPublic.id;
        } else {
          const created = await prisma.publicWord.create({
            data: {
              id: randomUUID(),
              word: normalizedWord,
              translation: translation,
              phonetic: word.phonetic,
              pos: word.pos,
              example: word.example,
              exampleTranslation: word.exampleTranslation,
              updatedAt: new Date()
            }
          });
          publicWordId = created.id;
        }
      }

      await prisma.word.update({
        where: { id: word.id },
        data: {
          sourceType: 'PUBLIC',
          publicWordId: publicWordId,
          translation: null,
          phonetic: null,
          pos: null,
          example: null,
          exampleTranslation: null
        }
      });

      fixed++;
      if (fixed % 500 === 0) {
        console.log(`已修复 ${fixed} 个单词...`);
      }
    } catch (err) {
      console.error(`修复单词 ${word.word} 失败:`, err instanceof Error ? err.message : String(err));
      skipped++;
    }
  }

  console.log(`\n完成! 共修复 ${fixed} 个单词，跳过 ${skipped} 个`);

  const stats = await prisma.word.groupBy({
    by: ['sourceType'],
    where: { userId: creator.id },
    _count: true
  });

  console.log('\ncreator 单词统计:');
  for (const s of stats) {
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

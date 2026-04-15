/**
 * 修复所有共享词汇的 wordCount 字段
 * 
 * 使用方法：
 * npx tsx scripts/fix-word-count.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixWordCount() {
  console.log('🔧 修复共享词汇的 wordCount 字段\n');
  
  const shares = await prisma.sharedVocabulary.findMany({
    include: {
      ReviewGroup: {
        include: {
          ReviewGroupWord: true
        }
      }
    }
  });
  
  console.log(`找到 ${shares.length} 个共享词库\n`);
  
  let updated = 0;
  let skipped = 0;
  
  for (const share of shares) {
    const actualCount = share.ReviewGroup.ReviewGroupWord.length;
    
    if (share.wordCount !== actualCount) {
      console.log(`📝 更新 "${share.name}" (${share.code})`);
      console.log(`   更新前：${share.wordCount} 词`);
      console.log(`   更新后：${actualCount} 词`);
      
      await prisma.sharedVocabulary.update({
        where: { id: share.id },
        data: { wordCount: actualCount }
      });
      
      updated++;
    } else {
      console.log(`✅ "${share.name}" ({share.code}) - 正确 (${actualCount} 词)`);
      skipped++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 修复完成！');
  console.log('   更新:', updated, '个');
  console.log('   跳过:', skipped, '个');
  console.log('='.repeat(60));
  
  await prisma.$disconnect();
}

fixWordCount().catch(console.error);

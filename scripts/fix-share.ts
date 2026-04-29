import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const code = process.argv[2]?.toUpperCase().trim() || 'L8E-QFX-52G';

  console.log(`检查分享码: ${code}\n`);

  const share = await prisma.sharedVocabulary.findUnique({
    where: { code },
    include: {
      ReviewGroup: {
        include: {
          _count: { select: { ReviewGroupWord: true } }
        }
      }
    }
  });

  if (!share) {
    console.log('❌ 分享不存在');
    return;
  }

  console.log('分享信息:');
  console.log(`  名称: ${share.name}`);
  console.log(`  ID: ${share.id}`);
  console.log(`  激活: ${share.isActive}`);
  console.log(`  单词数(share.wordCount): ${share.wordCount}`);
  console.log(`  实际组单词数: ${share.ReviewGroup?._count?.ReviewGroupWord || 0}`);
  console.log(`  使用次数(usedCount): ${share.usedCount}/${share.maxUses || '无限制'}`);
  console.log(`  导入次数(importedCount): ${share.importedCount}`);

  console.log('\n查找所有用户的导入记录:');
  const imports = await prisma.sharedVocabularyImport.findMany({
    where: { sharedId: share.id },
    include: {
      User: { select: { username: true } },
    }
  });

  if (imports.length === 0) {
    console.log('  没有任何导入记录');
  } else {
    for (const imp of imports) {
      console.log(`  - 用户: ${imp.User.username}, 时间: ${imp.createdAt.toLocaleString('zh-CN')}`);
      console.log(`    导入ID: ${imp.id}`);
      console.log(`    目标组: ${imp.targetGroupId}`);
      const group = await prisma.reviewGroup.findUnique({
        where: { id: imp.targetGroupId },
        include: { _count: { select: { ReviewGroupWord: true } } }
      });
      if (group) {
        console.log(`    组存在: ${group.name} (${group._count.ReviewGroupWord} 个单词)`);
      } else {
        console.log(`    组不存在! 需要删除这条导入记录`);
      }
    }
  }

  console.log('\n重置分享词库的 usedCount 和 importedCount...');
  await prisma.sharedVocabulary.update({
    where: { id: share.id },
    data: {
      usedCount: 0,
      importedCount: 0
    }
  });
  console.log('✅ 已重置分享词库状态');

  if (imports.length > 0) {
    console.log('\n删除孤立的导入记录...');
    for (const imp of imports) {
      const group = await prisma.reviewGroup.findUnique({ where: { id: imp.targetGroupId } });
      if (!group) {
        console.log(`  删除: ${imp.id}`);
        await prisma.sharedVocabularyImport.delete({ where: { id: imp.id } });
      }
    }
    console.log('✅ 已清理孤立导入记录');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

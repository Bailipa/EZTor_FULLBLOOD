import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const creator = await prisma.user.findUnique({
    where: { username: 'creator' }
  });

  if (!creator) {
    console.log('用户 creator 不存在');
    return;
  }

  console.log(`用户 ${creator.username} (ID: ${creator.id})\n`);

  const imports = await prisma.sharedVocabularyImport.findMany({
    where: { importerId: creator.id },
    include: {
      SharedVocabulary: {
        select: { code: true, name: true, wordCount: true }
      }
    }
  });

  if (imports.length === 0) {
    console.log('没有任何导入记录');
  } else {
    console.log(`导入记录 (${imports.length} 条):`);
    for (const imp of imports) {
      console.log(`  - ${imp.SharedVocabulary.name} (${imp.SharedVocabulary.code})`);
      console.log(`    导入ID: ${imp.id}`);
      console.log(`    目标组: ${imp.targetGroupId}`);
      console.log(`    时间: ${imp.createdAt.toLocaleString('zh-CN')}`);
    }
  }

  console.log('\n默认词库列表:');
  const defaults = await prisma.defaultVocabulary.findMany({
    orderBy: { sortOrder: 'asc' }
  });

  if (defaults.length === 0) {
    console.log('没有默认词库');
    return;
  }

  for (const def of defaults) {
    const shares = await prisma.sharedVocabulary.findMany({
      where: { name: def.name }
    });
    console.log(`  - ${def.name}: 代码 ${def.code}, 排序 ${def.sortOrder}`);
    for (const share of shares) {
      console.log(`    分享: ${share.code}, 状态: ${share.isActive ? '激活' : '禁用'}`);
    }
  }

  console.log('\n分享词库 XY3-HPV-FFU 状态:');
  const share = await prisma.sharedVocabulary.findUnique({
    where: { code: 'XY3-HPV-FFU' },
    include: {
      ReviewGroup: {
        include: {
          _count: { select: { ReviewGroupWord: true } }
        }
      }
    }
  });

  if (!share) {
    console.log('  不存在');
  } else {
    console.log(`  名称: ${share.name}`);
    console.log(`  激活: ${share.isActive}`);
    console.log(`  单词数: ${share.wordCount}`);
    console.log(`  实际组单词数: ${share.ReviewGroup?._count?.ReviewGroupWord || 0}`);
    console.log(`  使用次数: ${share.usedCount}/${share.maxUses || '无限制'}`);
    console.log(`  过期时间: ${share.expiresAt?.toISOString() || '无'}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

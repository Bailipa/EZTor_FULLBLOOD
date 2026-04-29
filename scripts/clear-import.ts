import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const code = process.argv[2]?.toUpperCase().trim();
  
  if (!code) {
    console.log('用法: npx tsx scripts/clear-import.ts <share_code>');
    console.log('示例: npx tsx scripts/clear-import.ts XY3-HPV-FFU');
    process.exit(1);
  }

  const share = await prisma.sharedVocabulary.findUnique({
    where: { code }
  });

  if (!share) {
    console.log(`❌ 分享码 "${code}" 不存在`);
    process.exit(1);
  }

  console.log(`\n分享信息:`);
  console.log(`  名称: ${share.name}`);
  console.log(`  ID: ${share.id}`);
  console.log(`  词数: ${share.wordCount}`);

  const imports = await prisma.sharedVocabularyImport.findMany({
    where: { sharedId: share.id },
    include: {
      User: {
        select: { username: true }
      }
    }
  });

  if (imports.length === 0) {
    console.log(`\n✅ 没有任何导入记录`);
    return;
  }

  console.log(`\n导入记录 (${imports.length} 条):`);
  for (const imp of imports) {
    const group = await prisma.reviewGroup.findUnique({
      where: { id: imp.targetGroupId }
    });
    console.log(`  - 用户: ${imp.User.username}, 目标组: ${imp.targetGroupId} ${group ? `(存在: ${group.name})` : '(已删除)'}`);
  }

  const allImports = await prisma.sharedVocabularyImport.findMany({
    where: { sharedId: share.id }
  });

  console.log(`\n删除所有 ${allImports.length} 条导入记录...`);
  await prisma.sharedVocabularyImport.deleteMany({
    where: { sharedId: share.id }
  });

  console.log(`✅ 已清除导入记录，现在可以重新导入`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

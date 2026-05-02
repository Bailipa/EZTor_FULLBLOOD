import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('重置所有分享词库状态并清除导入记录\n')

  const shares = await prisma.sharedVocabulary.findMany()

  console.log('重置分享词库状态:')
  for (const share of shares) {
    await prisma.sharedVocabulary.update({
      where: { id: share.id },
      data: {
        usedCount: 0,
        importedCount: 0,
      },
    })
    console.log(`  ${share.code}: 已重置`)
  }

  console.log('\n清除所有导入记录:')
  const importCount = await prisma.sharedVocabularyImport.count()
  if (importCount > 0) {
    await prisma.sharedVocabularyImport.deleteMany({})
    console.log(`  已删除 ${importCount} 条导入记录`)
  } else {
    console.log('  没有导入记录需要清除')
  }

  console.log('\n✅ 全部完成! 现在可以重新导入词库')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

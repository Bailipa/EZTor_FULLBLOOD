import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testImport() {
  console.log('🧪 测试导入 API\n');
  
  const share = await prisma.sharedVocabulary.findUnique({
    where: { code: 'M5P-VPF-WQV' },
    include: {
      ReviewGroup: {
        include: {
          ReviewGroupWord: {
            include: {
              Word: true
            }
          }
        }
      }
    }
  });
  
  if (!share) {
    console.log('❌ 分享记录不存在');
    return;
  }
  
  console.log('✅ 找到分享记录');
  console.log('   密钥:', share.code);
  console.log('   名称:', share.name);
  console.log('   词汇数:', share.wordCount);
  console.log('   关联分组词汇数:', share.ReviewGroup.ReviewGroupWord.length);
  
  const firstWord = share.ReviewGroup.ReviewGroupWord[0];
  console.log('\n📋 第一个单词示例:');
  console.log('   单词:', firstWord.Word.word);
  console.log('   音标:', firstWord.Word.phonetic);
  console.log('   词性:', firstWord.Word.pos);
  console.log('   释义:', firstWord.Word.translation);
  
  console.log('\n✅ 数据完整，可以正常导入');
  
  await prisma.$disconnect();
}

testImport().catch(console.error);

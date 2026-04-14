/**
 * 测试完整导入流程
 * 
 * 使用方法：
 * npx tsx scripts/test-full-import.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testFullImport() {
  console.log('🧪 测试完整导入流程\n');
  
  // 1. 查找测试用户
  let testUser = await prisma.user.findUnique({
    where: { username: 'testuser' }
  });
  
  if (!testUser) {
    console.log('📝 创建测试用户...');
    testUser = await prisma.user.create({
      data: {
        username: 'testuser',
        password: 'test_password',
      }
    });
    console.log('✅ 测试用户创建成功\n');
  }
  
  console.log('测试用户 ID:', testUser.id);
  console.log('用户名:', testUser.username, '\n');
  
  // 2. 查找分享记录
  const share = await prisma.sharedVocabulary.findUnique({
    where: { code: 'M5P-VPF-WQV' },
    include: {
      reviewGroup: {
        include: {
          words: {
            include: {
              word: true
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
  console.log('   关联词汇数:', share.reviewGroup.words.length, '\n');
  
  // 3. 检查是否已导入
  const existingImport = await prisma.sharedVocabularyImport.findUnique({
    where: {
      sharedId_importerId: {
        sharedId: share.id,
        importerId: testUser.id
      }
    }
  });
  
  if (existingImport) {
    console.log('⚠️  该用户已导入过此词库');
    console.log('   已导入词汇:', existingImport.wordsImported);
    console.log('   跳过词汇:', existingImport.wordsSkipped, '\n');
  }
  
  // 4. 检查用户的分组
  const userGroups = await prisma.reviewGroup.findMany({
    where: { userId: testUser.id },
    include: {
      _count: {
        select: { words: true }
      }
    }
  });
  
  console.log('📋 用户当前的分组:');
  if (userGroups.length === 0) {
    console.log('   (无分组)');
  } else {
    userGroups.forEach(g => {
      console.log(`   - ${g.name}: ${g._count.words} 个词`);
    });
  }
  
  console.log('\n✅ 测试准备完成');
  console.log('\n📝 下一步：');
  console.log('   1. 在浏览器中登录 testuser 用户');
  console.log('   2. 打开导入模态框');
  console.log('   3. 点击 "大学英语四六级核心词汇" 卡片');
  console.log('   4. 输入分组名称（如 "四级词汇"）');
  console.log('   5. 点击 "导入词库"');
  console.log('   6. 检查导入结果\n');
  
  await prisma.$disconnect();
}

testFullImport().catch(console.error);

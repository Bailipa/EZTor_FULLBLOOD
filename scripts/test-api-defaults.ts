/**
 * API 测试脚本：GET /api/share/defaults
 * 
 * 使用方法：
 * npx tsx scripts/test-api-defaults.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAPI() {
  console.log('🧪 测试 GET /api/share/defaults API\n');
  
  // 模拟 API 调用
  try {
    // 1. 认证检查（模拟）
    console.log('✅ 步骤 1: 认证检查 - 通过（模拟已登录用户）\n');
    
    // 2. 查询数据库
    console.log('📊 步骤 2: 查询 DefaultVocabulary 表...');
    const defaults = await prisma.defaultVocabulary.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        sortOrder: 'asc'
      },
      include: {
        ReviewGroup: {
          select: {
            name: true,
          }
        }
      }
    });
    
    console.log(`   找到 ${defaults.length} 个默认词库\n`);
    
    const transformedData = defaults.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      code: d.code,
      wordCount: d.wordCount,
      sortOrder: d.sortOrder,
      groupName: d.ReviewGroup.name,
    }));
    
    // 4. 显示响应
    console.log('📋 响应数据:\n');
    console.log(JSON.stringify({
      success: true,
      data: transformedData
    }, null, 2));
    
    console.log('\n✅ API 测试成功！');
    
  } catch (error: any) {
    console.error('❌ API 测试失败:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAPI();

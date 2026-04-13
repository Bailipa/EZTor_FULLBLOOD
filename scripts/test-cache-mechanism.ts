/**
 * 缓存机制测试脚本
 * 
 * 测试缓存是否按预期工作：
 * 1. 第一次查询应该访问数据库
 * 2. 第二次查询应该使用缓存
 * 3. 缓存应该在 TTL 内有效
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 模拟缓存机制
interface CacheEntry {
  data: any[];
  timestamp: number;
}

const defaultVocabCache = new Map<string, CacheEntry>();
const CACHE_TTL = 3600000; // 1 hour

async function getDefaultVocabularies(debug = false) {
  const cached = defaultVocabCache.get('defaults');
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    if (debug) console.log('  ✅ 使用缓存数据');
    return cached.data;
  }
  
  if (debug) console.log('  📊 查询数据库...');
  
  const defaults = await prisma.defaultVocabulary.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      reviewGroup: { select: { name: true } }
    }
  });
  
  const transformedData = defaults.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    code: d.code,
    wordCount: d.wordCount,
    sortOrder: d.sortOrder,
    groupName: d.reviewGroup.name,
  }));
  
  defaultVocabCache.set('defaults', {
    data: transformedData,
    timestamp: Date.now()
  });
  
  if (debug) console.log('  💾 缓存已更新');
  
  return transformedData;
}

async function testCache() {
  console.log('🧪 测试缓存机制\n');
  
  // 测试 1: 第一次查询（应该访问数据库）
  console.log('📌 测试 1: 第一次查询');
  const result1 = await getDefaultVocabularies(true);
  console.log(`   返回 ${result1.length} 个词库\n`);
  
  // 测试 2: 第二次查询（应该使用缓存）
  console.log('📌 测试 2: 第二次查询（立即）');
  const result2 = await getDefaultVocabularies(true);
  console.log(`   返回 ${result2.length} 个词库\n`);
  
  // 测试 3: 验证缓存数据一致性
  console.log('📌 测试 3: 验证数据一致性');
  const isSame = JSON.stringify(result1) === JSON.stringify(result2);
  console.log(`   数据一致性：${isSame ? '✅ 相同' : '❌ 不同'}\n`);
  
  // 测试 4: 显示缓存信息
  console.log('📌 测试 4: 缓存信息');
  const cacheInfo = defaultVocabCache.get('defaults');
  if (cacheInfo) {
    const age = Date.now() - cacheInfo.timestamp;
    console.log(`   缓存年龄：${age}ms`);
    console.log(`   缓存 TTL: ${CACHE_TTL}ms (1 小时)`);
    console.log(`   剩余有效时间：${CACHE_TTL - age}ms\n`);
  }
  
  // 测试 5: 模拟缓存过期
  console.log('📌 测试 5: 模拟缓存过期');
  const expiredCache = defaultVocabCache.get('defaults');
  if (expiredCache) {
    expiredCache.timestamp = Date.now() - CACHE_TTL - 1000; // 设置为过期
    defaultVocabCache.set('defaults', expiredCache);
    
    const result3 = await getDefaultVocabularies(true);
    console.log(`   缓存过期后重新查询，返回 ${result3.length} 个词库\n`);
  }
  
  console.log('✅ 所有缓存测试完成！');
  
  await prisma.$disconnect();
}

testCache();

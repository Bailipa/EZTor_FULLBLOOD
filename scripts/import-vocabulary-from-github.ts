/**
 * 从 GitHub 仓库导入词汇数据到默认词库
 * 
 * 数据源：https://github.com/KyleBing/english-vocabulary.git
 * 
 * 使用方法：
 * npx tsx scripts/import-vocabulary-from-github.ts [category]
 * 
 * 参数：
 * - category: 词库类别（可选）
 *   - cet4: 大学英语四级
 *   - cet6: 大学英语六级
 *   - postgraduate: 考研
 *   - all: 所有词库（默认）
 * 
 * 示例：
 * npx tsx scripts/import-vocabulary-from-github.ts cet4
 * npx tsx scripts/import-vocabulary-from-github.ts all
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

console.log('Database URL:', process.env.DATABASE_URL);
const prisma = new PrismaClient();

// 词库配置映射
const VOCABULARY_CONFIG = {
  cet4: {
    name: '大学英语四级核心词汇',
    description: '包含 CET-4 核心词汇',
    groupName: '四级核心词汇',
    jsonFile: '3-CET4-顺序.json',
    sortOrder: 1,
  },
  cet6: {
    name: '大学英语六级核心词汇',
    description: '包含 CET-6 核心词汇',
    groupName: '六级核心词汇',
    jsonFile: '4-CET6-顺序.json',
    sortOrder: 2,
  },
  postgraduate: {
    name: '考研核心词汇',
    description: '硕士研究生入学考试核心词汇',
    groupName: '考研核心词汇',
    jsonFile: '5-考研-顺序.json',
    sortOrder: 3,
  },
  ielts: {
    name: '雅思核心词汇',
    description: '雅思考试核心词汇（使用托福词汇数据作为替代）',
    groupName: '雅思核心词汇',
    jsonFile: '6-托福-顺序.json',
    sortOrder: 4,
  },
};

interface WordData {
  word: string;
  translations?: Array<{
    translation: string;
    type?: string;
  }>;
  phrases?: Array<{
    phrase: string;
    translation: string;
  }>;
}

/**
 * 解析 JSON 文件中的词汇数据
 */
function parseVocabularyJSON(filePath: string): WordData[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  // JSON 文件是一个数组，每个元素是一个单词对象
  return data;
}

/**
 * 批量导入词汇（使用事务优化性能）
 */
async function batchImportWords(
  userId: string,
  groupId: string,
  words: WordData[]
): Promise<{ imported: number; skipped: number; failed: number }> {
  const batchSize = 100;
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  
  try {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < words.length; i += batchSize) {
        const batch = words.slice(i, i + batchSize);
        
        for (const wordData of batch) {
          try {
            const normalizedWord = wordData.word.toLowerCase().trim();
            
            // 打印前几个单词
            if (i === 0 && batch.indexOf(wordData) < 5) {
              console.log('Importing word:', normalizedWord);
            }
            
            // 检查是否已存在
            const existing = await tx.word.findUnique({
              where: {
                word_userId: {
                  word: normalizedWord,
                  userId
                }
              }
            });
            
            if (existing) {
              if (i === 0 && batch.indexOf(wordData) < 5) {
                console.log('Word already exists:', normalizedWord);
              }
              skipped++;
              continue;
            }
            
            // 提取翻译信息
            let translation = 'No translation';
            if (wordData.translations && wordData.translations.length > 0) {
              translation = wordData.translations
                .map(t => `${t.type ? t.type + ' ' : ''}${t.translation}`)
                .join('; ');
            }
            
            // 提取音标（如果有）
            let phonetic: string | null = null;
            
            // 提取词性（如果有）
            let pos: string | null = null;
            if (wordData.translations && wordData.translations.length > 0) {
              const firstType = wordData.translations[0].type;
              if (firstType) {
                pos = firstType.trim();
              }
            }
            
            // 提取例句或短语（取第一个作为示例）
            let example: string | null = null;
            let exampleTranslation: string | null = null;
            if (wordData.phrases && wordData.phrases.length > 0) {
              example = wordData.phrases[0].phrase;
              exampleTranslation = wordData.phrases[0].translation;
            }
            
            // 创建单词
            const word = await tx.word.create({
              data: {
                id: randomUUID(),
                word: normalizedWord,
                phonetic,
                pos,
                translation,
                example,
                exampleTranslation,
                userId,
                updatedAt: new Date(),
              }
            });
            
            // 创建分组关联
            await tx.reviewGroupWord.create({
              data: {
                id: randomUUID(),
                reviewGroupId: groupId,
                wordId: word.id
              }
            });
            
            imported++;
          } catch (error) {
            console.error(`    ⚠️  导入单词 "${wordData.word}" 失败:`, (error as Error).message);
            failed++;
          }
        }
        
        // 显示进度
        const processed = Math.min(i + batchSize, words.length);
        if (processed % 500 === 0 || processed === words.length) {
          const percent = Math.round(processed / words.length * 100);
          console.log(`    进度：${processed}/${words.length} (${percent}%) - 已导入：${imported}, 跳过：${skipped}, 失败：${failed}`);
        }
      }
    });
  } catch (error) {
    console.error('Transaction error:', error);
    throw error;
  }
  
  return { imported, skipped, failed };
}

async function main() {
  const category = process.argv[2] || 'all';
  
  console.log('📚 从 GitHub 仓库导入词汇数据\n');
  console.log('数据源：https://github.com/KyleBing/english-vocabulary.git\n');
  
  // 确定要导入的词库
  const categoriesToImport = category === 'all' 
    ? Object.keys(VOCABULARY_CONFIG) 
    : [category];
  
  if (categoriesToImport.length === 0) {
    console.log('❌ 无效的词库类别');
    console.log('可用类别：cet4, cet6, postgraduate, all');
    return;
  }
  
  console.log(`📊 准备导入的词库：${categoriesToImport.join(', ')}\n`);
  
  // 获取或创建系统用户
  let systemUser = await prisma.user.findUnique({
    where: { username: 'system' }
  });
  
  console.log('Current users:', await prisma.user.findMany());
  
  if (!systemUser) {
    console.log('📝 创建系统用户...');
    systemUser = await prisma.user.create({
      data: {
        id: randomUUID(),
        username: 'system',
        password: 'system_password_not_for_login',
        isAdmin: true,
        updatedAt: new Date(),
      }
    });
    console.log('✅ 系统用户创建成功:', systemUser);
  } else {
    console.log('✅ 系统用户已存在:', systemUser);
  }
  
  // JSON 文件路径
  const jsonDir = '/tmp/english-vocabulary/json';
  
  if (!fs.existsSync(jsonDir)) {
    console.log('❌ 未找到词汇数据，请先运行：git clone https://github.com/KyleBing/english-vocabulary.git /tmp/english-vocabulary');
    return;
  }
  
  for (const cat of categoriesToImport) {
    const config = VOCABULARY_CONFIG[cat as keyof typeof VOCABULARY_CONFIG];
    
    if (!config) {
      console.log(`⚠️  跳过未知类别：${cat}`);
      continue;
    }
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📖 处理词库：${config.name}`);
    console.log('='.repeat(80));
    
    const jsonFilePath = path.join(jsonDir, config.jsonFile);
    
    if (!fs.existsSync(jsonFilePath)) {
      console.log(`  ❌ 文件不存在：${jsonFilePath}`);
      continue;
    }
    
    try {
      // 1. 解析 JSON 数据
      console.log(`  📝 解析 JSON 文件：${config.jsonFile}...`);
      const words = parseVocabularyJSON(jsonFilePath);
      console.log(`  📊 找到 ${words.length} 个单词`);
      
      // 2. 创建或获取 ReviewGroup
      let reviewGroup = await prisma.reviewGroup.findUnique({
        where: {
          name_userId: {
            name: config.groupName,
            userId: systemUser.id
          }
        }
      });
      
      if (!reviewGroup) {
        console.log(`  📝 创建复习分组：${config.groupName}`);
        reviewGroup = await prisma.reviewGroup.create({
          data: {
            id: randomUUID(),
            name: config.groupName,
            userId: systemUser.id,
            updatedAt: new Date(),
          }
        });
        console.log(`  ✅ 分组创建成功 (ID: ${reviewGroup.id})`);
      } else {
        console.log(`  ℹ️  分组已存在 (ID: ${reviewGroup.id})`);
      }
      
      // 3. 批量导入词汇
      console.log(`  📝 批量导入词汇 (${words.length} 个)...`);
      
      const { imported, skipped, failed } = await batchImportWords(
        systemUser.id,
        reviewGroup.id,
        words
      );
      
      console.log(`  ✅ 词汇导入完成:`);
      console.log(`     - 导入：${imported} 个`);
      console.log(`     - 跳过：${skipped} 个`);
      console.log(`     - 失败：${failed} 个`);
      
      // 4. 更新或创建 SharedVocabulary
      const existingShare = await prisma.sharedVocabulary.findFirst({
        where: {
          reviewGroupId: reviewGroup.id,
          userId: systemUser.id
        }
      });
      
      let shareCode: string;
      
      if (existingShare) {
        console.log(`  ℹ️  分享记录已存在 (Code: ${existingShare.code})`);
        shareCode = existingShare.code;
        
        // 更新词汇数
        await prisma.sharedVocabulary.update({
          where: { id: existingShare.id },
          data: {
            wordCount: imported,
          }
        });
      } else {
        // 生成分享密钥（简单生成，实际应该用更安全的算法）
        const generateCode = () => {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let code = '';
          for (let i = 0; i < 3; i++) {
            if (i > 0) code += '-';
            for (let j = 0; j < 3; j++) {
              code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
          }
          return code;
        };
        
        shareCode = generateCode();
        
        const _sharedVocab = await prisma.sharedVocabulary.create({
          data: {
            id: randomUUID(),
            code: shareCode,
            name: config.name,
            description: config.description,
            userId: systemUser.id,
            shareType: 'REVIEW_GROUP',
            reviewGroupId: reviewGroup.id,
            wordCount: imported,
            maxUses: null,
            expiresAt: null,
            isActive: true,
            updatedAt: new Date(),
          }
        });
        
        console.log(`  ✅ 分享密钥生成成功：${shareCode}`);
      }
      
      // 5. 更新或创建 DefaultVocabulary
      const existingDefault = await prisma.defaultVocabulary.findMany({
        where: {
          groupId: reviewGroup.id
        }
      });
      
      if (existingDefault.length > 0) {
        console.log(`  ℹ️  默认词库配置已存在，更新中...`);
        
        // 更新第一个配置
        await prisma.defaultVocabulary.update({
          where: { id: existingDefault[0].id },
          data: {
            name: config.name,
            code: shareCode,
            description: config.description,
            wordCount: imported,
            sortOrder: config.sortOrder,
          }
        });
      } else {
        console.log(`  📝 创建默认词库配置...`);
        await prisma.defaultVocabulary.create({
          data: {
            id: randomUUID(),
            name: config.name,
            code: shareCode,
            description: config.description,
            groupId: reviewGroup.id,
            wordCount: imported,
            isActive: true,
            sortOrder: config.sortOrder,
            updatedAt: new Date(),
          }
        });
      }
      
      console.log(`  ✅ 默认词库配置完成`);
      
    } catch (error) {
      console.error(`❌ 处理词库 "${config.name}" 时出错:`, error);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 所有词库导入完成！');
  console.log('='.repeat(80));
  
  // 显示所有默认词库
  const defaults = await prisma.defaultVocabulary.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      reviewGroup: true
    }
  });
  
  console.log('\n📋 默认词库列表：');
  console.log('─'.repeat(80));
  defaults.forEach((d, i) => {
    console.log(`${i + 1}. ${d.name}`);
    console.log(`   描述：${d.description || '无'}`);
    console.log(`   词汇数：${d.wordCount}`);
    console.log(`   密钥：${d.code}`);
    console.log(`   分组：${d.reviewGroup.name}`);
    console.log('─'.repeat(80));
  });
  
  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('❌ 导入脚本执行失败:', e);
    process.exit(1);
  });

/**
 * 从上游 json-sentence 数据补充词库中缺失的例句、音标、词性等内容
 *
 * 数据源：
 *   https://github.com/KyleBing/english-vocabulary.git
 *   (json_original/json-sentence/ 目录)
 *
 * 功能：
 *   1. 自动克隆/拉取上游仓库
 *   2. 加载 json-sentence 文件构建查找索引
 *   3. 匹配 Word 和 PublicWord 表中缺失字段的条目
 *   4. 补充 example, exampleTranslation, phonetic, pos
 *   5. 生成补充报告
 *
 * 使用方法：
 *   npx tsx scripts/supplement-word-data.ts [--dry-run] [--public-only] [--word-only]
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

const REPO_URL = 'https://github.com/KyleBing/english-vocabulary.git';
const REPO_DIR = '/tmp/english-vocabulary';
const SENTENCE_DIR = path.join(REPO_DIR, 'json_original', 'json-sentence');

interface SentenceEntry {
  sentence: string;
  translation: string;
}

interface UpstreamWordData {
  word: string;
  us?: string;
  uk?: string;
  translations?: Array<{ translation: string; type?: string }>;
  phrases?: Array<{ phrase: string; translation: string }>;
  sentences?: SentenceEntry[];
}

interface SupplementStats {
  wordTable: {
    total: number;
    exampleSupplemented: number;
    phoneticSupplemented: number;
    posSupplemented: number;
  };
  publicWordTable: {
    total: number;
    exampleSupplemented: number;
    phoneticSupplemented: number;
    posSupplemented: number;
  };
}

function cloneOrPullRepo(): boolean {
  if (fs.existsSync(REPO_DIR)) {
    console.log('📦 上游仓库已存在，正在拉取最新数据...');
    try {
      execSync('git pull --ff-only', { cwd: REPO_DIR, stdio: 'pipe', timeout: 30000 });
      console.log('✅ 拉取完成');
      return true;
    } catch {
      console.log('⚠️  拉取失败，重新克隆...');
      fs.rmSync(REPO_DIR, { recursive: true, force: true });
    }
  }

  console.log('📦 克隆上游仓库...');
  try {
    execSync(`git clone --depth 1 ${REPO_URL} ${REPO_DIR}`, { stdio: 'pipe', timeout: 60000 });
    console.log('✅ 克隆完成');
    return true;
  } catch (err) {
    console.error('❌ 克隆失败:', (err as Error).message);
    return false;
  }
}

function loadSentenceFiles(): Map<string, UpstreamWordData> {
  const wordMap = new Map<string, UpstreamWordData>();

  if (!fs.existsSync(SENTENCE_DIR)) {
    console.error(`❌ json-sentence 目录不存在: ${SENTENCE_DIR}`);
    return wordMap;
  }

  const files = fs.readdirSync(SENTENCE_DIR).filter(f => f.endsWith('.json'));
  console.log(`📂 找到 ${files.length} 个 json-sentence 文件`);

  for (const file of files) {
    const filePath = path.join(SENTENCE_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const entries: UpstreamWordData[] = JSON.parse(content);

      for (const entry of entries) {
        if (!entry.word) continue;
        const key = entry.word.toLowerCase().trim();

        const existing = wordMap.get(key);
        if (existing) {
          // 合并数据：优先保留有价值的内容
          if (!existing.us && entry.us) existing.us = entry.us;
          if (!existing.uk && entry.uk) existing.uk = entry.uk;
          if (!existing.sentences || existing.sentences.length === 0) {
            existing.sentences = entry.sentences;
          } else if (entry.sentences && entry.sentences.length > 0) {
            // 合并更多句子，但不超过5个
            const combined = new Set(existing.sentences.map(s => s.sentence));
            for (const s of entry.sentences) {
              if (!combined.has(s.sentence)) {
                combined.add(s.sentence);
                existing.sentences.push(s);
                if (existing.sentences.length >= 5) break;
              }
            }
          }
          if (!existing.translations || existing.translations.length === 0) {
            existing.translations = entry.translations;
          }
          if (!existing.phrases || existing.phrases.length === 0) {
            existing.phrases = entry.phrases;
          }
        } else {
          wordMap.set(key, entry);
        }
      }

      if (files.indexOf(file) % 20 === 0) {
        console.log(`  进度: ${files.indexOf(file) + 1}/${files.length} 个文件...`);
      }
    } catch (err) {
      console.error(`  ⚠️  解析文件失败: ${file}`, (err as Error).message);
    }
  }

  console.log(`✅ 加载完成: ${wordMap.size} 个独立词条`);
  return wordMap;
}

function pickBestSentence(word: string, data: UpstreamWordData): { example: string; exampleTranslation: string } | null {
  if (!data.sentences || data.sentences.length === 0) {
    // 如果 phrases 存在，用第一个作为例句
    if (data.phrases && data.phrases.length > 0) {
      return {
        example: data.phrases[0].phrase,
        exampleTranslation: data.phrases[0].translation,
      };
    }
    return null;
  }

  // 评分挑选最佳例句
  const scored = data.sentences.map((s, idx) => {
    const sentenceWords = s.sentence.toLowerCase().split(/\s+/);
    const wordCount = sentenceWords.length;
    const wordLower = word.toLowerCase();
    const containsWord = s.sentence.toLowerCase().includes(wordLower);
    let score = 0;
    // 长度适宜 (5-20词最合适)
    if (wordCount >= 5 && wordCount <= 20) score += 10;
    else if (wordCount < 3) score += 2;
    else if (wordCount > 30) score += 3;
    else score += 5;
    // 包含目标词
    if (containsWord) score += 8;
    // 优先前面的（通常更重要）
    score += Math.max(0, (10 - idx) * 0.5);
    return { sentence: s, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].sentence;
  return {
    example: best.sentence,
    exampleTranslation: best.translation,
  };
}

function getPhonetic(data: UpstreamWordData): string | null {
  // 优先使用 us 音标，其次 uk
  if (data.us) return `/${data.us}/`;
  if (data.uk) return `/${data.uk}/`;
  return null;
}

function getPos(data: UpstreamWordData): string | null {
  if (data.translations && data.translations.length > 0) {
    const types = data.translations
      .map(t => t.type)
      .filter((t): t is string => typeof t === 'string' && t.length > 0);
    if (types.length > 0) return types.join(' ');
  }
  return null;
}

async function supplementWords(
  wordMap: Map<string, UpstreamWordData>,
  dryRun: boolean,
  targetWord: boolean,
  targetPublic: boolean
): Promise<SupplementStats> {
  const stats: SupplementStats = {
    wordTable: { total: 0, exampleSupplemented: 0, phoneticSupplemented: 0, posSupplemented: 0 },
    publicWordTable: { total: 0, exampleSupplemented: 0, phoneticSupplemented: 0, posSupplemented: 0 },
  };

  // === 补充 Word 表 ===
  if (targetWord) {
    console.log('\n📝 [Word 表] 查找缺失数据的词条...');
    const wordsToSupplement = await prisma.word.findMany({
      where: {
        OR: [
          { example: null },
          { example: '' },
          { phonetic: null },
          { phonetic: '' },
          { pos: null },
          { pos: '' },
        ],
      },
      select: { id: true, word: true, example: true, exampleTranslation: true, phonetic: true, pos: true },
    });

    stats.wordTable.total = wordsToSupplement.length;
    console.log(`  找到 ${wordsToSupplement.length} 个有缺失字段的词条`);

    if (dryRun) {
      console.log('  🏷️  Dry-run 模式，不实际更新');
      let matchCount = 0;
      for (const w of wordsToSupplement) {
        const upstream = wordMap.get(w.word.toLowerCase());
        if (upstream) matchCount++;
      }
      console.log(`  可在上游匹配到 ${matchCount} 个词条`);
      stats.wordTable.exampleSupplemented = matchCount;
      stats.wordTable.phoneticSupplemented = matchCount;
      stats.wordTable.posSupplemented = matchCount;
    } else {
      let updated = 0;
      let exampleCount = 0;
      let phoneticCount = 0;
      let posCount = 0;
      const batchSize = 50;

      for (let i = 0; i < wordsToSupplement.length; i += batchSize) {
        const batch = wordsToSupplement.slice(i, i + batchSize);
        const updates: Promise<any>[] = [];

        for (const w of batch) {
          const upstream = wordMap.get(w.word.toLowerCase());
          if (!upstream) continue;

          const needsExample = !w.example || w.example === '';
          const needsPhonetic = !w.phonetic || w.phonetic === '';
          const needsPos = !w.pos || w.pos === '';

          if (!needsExample && !needsPhonetic && !needsPos) continue;

          const updateData: Record<string, string | null> = {};
          const sentence = needsExample ? pickBestSentence(w.word, upstream) : null;
          const phonetic = needsPhonetic ? getPhonetic(upstream) : null;
          const pos = needsPos ? getPos(upstream) : null;

          if (sentence) {
            updateData.example = sentence.example;
            updateData.exampleTranslation = sentence.exampleTranslation;
            exampleCount++;
          }
          if (phonetic) {
            updateData.phonetic = phonetic;
            phoneticCount++;
          }
          if (pos) {
            updateData.pos = pos;
            posCount++;
          }

          if (Object.keys(updateData).length > 0) {
            updates.push(
              prisma.word.update({
                where: { id: w.id },
                data: updateData,
              })
            );
            updated++;
          }
        }

        await Promise.all(updates);

        const processed = Math.min(i + batchSize, wordsToSupplement.length);
        if (processed % 500 === 0 || processed === wordsToSupplement.length) {
          console.log(`  进度: ${processed}/${wordsToSupplement.length} (已更新: ${updated})`);
        }
      }

      stats.wordTable.exampleSupplemented = exampleCount;
      stats.wordTable.phoneticSupplemented = phoneticCount;
      stats.wordTable.posSupplemented = posCount;
      console.log(`  ✅ 更新了 ${updated} 个词条`);
    }
  }

  // === 补充 PublicWord 表 ===
  if (targetPublic) {
    console.log('\n📝 [PublicWord 表] 查找缺失数据的词条...');
    const publicWordsToSupplement = await prisma.publicWord.findMany({
      where: {
        OR: [
          { example: null },
          { example: '' },
          { phonetic: null },
          { phonetic: '' },
          { pos: null },
          { pos: '' },
        ],
      },
      select: { id: true, word: true, example: true, exampleTranslation: true, phonetic: true, pos: true },
    });

    stats.publicWordTable.total = publicWordsToSupplement.length;
    console.log(`  找到 ${publicWordsToSupplement.length} 个有缺失字段的公共词条`);

    if (dryRun) {
      console.log('  🏷️  Dry-run 模式，不实际更新');
      let matchCount = 0;
      for (const w of publicWordsToSupplement) {
        const upstream = wordMap.get(w.word.toLowerCase());
        if (upstream) matchCount++;
      }
      console.log(`  可在上游匹配到 ${matchCount} 个词条`);
      stats.publicWordTable.exampleSupplemented = matchCount;
      stats.publicWordTable.phoneticSupplemented = matchCount;
      stats.publicWordTable.posSupplemented = matchCount;
    } else {
      let updated = 0;
      let exampleCount = 0;
      let phoneticCount = 0;
      let posCount = 0;
      const batchSize = 50;

      for (let i = 0; i < publicWordsToSupplement.length; i += batchSize) {
        const batch = publicWordsToSupplement.slice(i, i + batchSize);
        const updates: Promise<any>[] = [];

        for (const w of batch) {
          const upstream = wordMap.get(w.word.toLowerCase());
          if (!upstream) continue;

          const needsExample = !w.example || w.example === '';
          const needsPhonetic = !w.phonetic || w.phonetic === '';
          const needsPos = !w.pos || w.pos === '';

          if (!needsExample && !needsPhonetic && !needsPos) continue;

          const updateData: Record<string, string | null> = {};
          const sentence = needsExample ? pickBestSentence(w.word, upstream) : null;
          const phonetic = needsPhonetic ? getPhonetic(upstream) : null;
          const pos = needsPos ? getPos(upstream) : null;

          if (sentence) {
            updateData.example = sentence.example;
            updateData.exampleTranslation = sentence.exampleTranslation;
            exampleCount++;
          }
          if (phonetic) {
            updateData.phonetic = phonetic;
            phoneticCount++;
          }
          if (pos) {
            updateData.pos = pos;
            posCount++;
          }

          if (Object.keys(updateData).length > 0) {
            updates.push(
              prisma.publicWord.update({
                where: { id: w.id },
                data: updateData,
              })
            );
            updated++;
          }
        }

        await Promise.all(updates);

        const processed = Math.min(i + batchSize, publicWordsToSupplement.length);
        if (processed % 500 === 0 || processed === publicWordsToSupplement.length) {
          console.log(`  进度: ${processed}/${publicWordsToSupplement.length} (已更新: ${updated})`);
        }
      }

      stats.publicWordTable.exampleSupplemented = exampleCount;
      stats.publicWordTable.phoneticSupplemented = phoneticCount;
      stats.publicWordTable.posSupplemented = posCount;
      console.log(`  ✅ 更新了 ${updated} 个公共词条`);
    }
  }

  return stats;
}

function printReport(stats: SupplementStats, dryRun: boolean) {
  console.log('\n' + '='.repeat(70));
  console.log(`📊 补充报告 ${dryRun ? '(DRY-RUN)' : ''}`);
  console.log('='.repeat(70));

  console.log('\n📋 Word 表:');
  console.log(`  总计需要处理: ${stats.wordTable.total}`);
  console.log(`  补充例句: ${stats.wordTable.exampleSupplemented}`);
  console.log(`  补充音标: ${stats.wordTable.phoneticSupplemented}`);
  console.log(`  补充词性: ${stats.wordTable.posSupplemented}`);

  console.log('\n📋 PublicWord 表:');
  console.log(`  总计需要处理: ${stats.publicWordTable.total}`);
  console.log(`  补充例句: ${stats.publicWordTable.exampleSupplemented}`);
  console.log(`  补充音标: ${stats.publicWordTable.phoneticSupplemented}`);
  console.log(`  补充词性: ${stats.publicWordTable.posSupplemented}`);

  console.log('\n' + '='.repeat(70));
}

async function printDatabaseSnapshot() {
  const totalWords = await prisma.word.count();
  const wordsWithExamples = await prisma.word.count({
    where: { example: { not: null } },
  });
  const wordsWithPhonetic = await prisma.word.count({
    where: { phonetic: { not: null } },
  });
  const wordsWithPos = await prisma.word.count({
    where: { pos: { not: null } },
  });

  const totalPublic = await prisma.publicWord.count();
  const publicWithExamples = await prisma.publicWord.count({
    where: { example: { not: null } },
  });
  const publicWithPhonetic = await prisma.publicWord.count({
    where: { phonetic: { not: null } },
  });
  const publicWithPos = await prisma.publicWord.count({
    where: { pos: { not: null } },
  });

  console.log('\n📊 当前数据库状态:');
  console.log('─'.repeat(50));
  console.log(`  Word 总计:       ${totalWords}`);
  console.log(`    有例句: ${wordsWithExamples} (${totalWords > 0 ? Math.round(wordsWithExamples / totalWords * 100) : 0}%)`);
  console.log(`    有音标: ${wordsWithPhonetic} (${totalWords > 0 ? Math.round(wordsWithPhonetic / totalWords * 100) : 0}%)`);
  console.log(`    有词性: ${wordsWithPos} (${totalWords > 0 ? Math.round(wordsWithPos / totalWords * 100) : 0}%)`);
  console.log('');
  console.log(`  PublicWord 总计:  ${totalPublic}`);
  console.log(`    有例句: ${publicWithExamples} (${totalPublic > 0 ? Math.round(publicWithExamples / totalPublic * 100) : 0}%)`);
  console.log(`    有音标: ${publicWithPhonetic} (${totalPublic > 0 ? Math.round(publicWithPhonetic / totalPublic * 100) : 0}%)`);
  console.log(`    有词性: ${publicWithPos} (${totalPublic > 0 ? Math.round(publicWithPos / totalPublic * 100) : 0}%)`);
  console.log('─'.repeat(50));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const publicOnly = args.includes('--public-only');
  const wordOnly = args.includes('--word-only');
  const targetWord = !publicOnly;
  const targetPublic = !wordOnly;

  console.log('🔧 词条数据补充脚本');
  console.log(`   模式: ${dryRun ? 'DRY-RUN (预览)' : '实际执行'}`);
  console.log(`   目标: ${wordOnly ? '仅 Word 表' : publicOnly ? '仅 PublicWord 表' : 'Word + PublicWord 表'}\n`);

  // Step 1: 克隆/拉取上游仓库
  const repoReady = cloneOrPullRepo();
  if (!repoReady) {
    console.error('❌ 无法获取上游数据，终止');
    process.exit(1);
  }

  // Step 2: 加载上游数据
  console.log('\n📖 加载 json-sentence 数据...');
  const wordMap = loadSentenceFiles();

  // Step 3: 补充缺失数据
  const stats = await supplementWords(wordMap, dryRun, targetWord, targetPublic);

  // Step 4: 打印报告
  printReport(stats, dryRun);

  // Step 5: 打印当前数据库状态
  await printDatabaseSnapshot();

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('❌ 脚本执行失败:', e);
    process.exit(1);
  });

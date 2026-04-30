/**
 * 数据补全验证脚本
 *
 * 功能：
 *   1. 检查 Word 和 PublicWord 表的完整性
 *   2. 采样验证例句质量（长度、语言、是否包含目标词）
 *   3. 验证音标格式是否正确
 *   4. 统计补全后的覆盖率
 *   5. 输出 JSON 格式验证报告
 *
 * 使用方法：
 *   npx tsx scripts/verify-supplementation.ts [--output report.json]
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

interface QualityIssue {
  id: string;
  word: string;
  field: string;
  issue: string;
  currentValue: string | null;
}

interface VerificationReport {
  timestamp: string;
  summary: {
    wordTable: {
      total: number;
      withExample: number;
      withExamplePercent: number;
      withPhonetic: number;
      withPhoneticPercent: number;
      withPos: number;
      withPosPercent: number;
      fullyComplete: number;
      fullyCompletePercent: number;
    };
    publicWordTable: {
      total: number;
      withExample: number;
      withExamplePercent: number;
      withPhonetic: number;
      withPhoneticPercent: number;
      withPos: number;
      withPosPercent: number;
      fullyComplete: number;
      fullyCompletePercent: number;
    };
  };
  qualityCheck: {
    examplesSampled: number;
    issuesFound: number;
    issues: QualityIssue[];
  };
}

function isValidExample(example: string, word: string): string | null {
  if (!example || example.trim().length === 0) return null;

  // 检查是否为单数且合理长度
  if (example.trim().length < 3) return '例句过短';
  if (example.trim().length < 8 && !example.includes(word)) return '例句可能过短且不含目标词';

  // 检查是否包含英文字母
  const alphaCount = (example.match(/[a-zA-Z]/g) || []).length;
  if (alphaCount < 2) return '例句中英文内容过少';

  // 检查是否类似短语而非完整句子（不含空格可能不是句子）
  if (!example.includes(' ') && example.length > 15) return '可能不是完整句子（无空格）';

  return null;
}

function isValidPhonetic(phonetic: string): string | null {
  if (!phonetic || phonetic.trim().length === 0) return null;

  // 音标应该包含 / /
  if (!phonetic.includes('/')) return '音标格式不正确（缺少斜杠）';

  // 检查是否只有括号
  const content = phonetic.replace(/\//g, '').trim();
  if (content.length === 0) return '音标为空';

  return null;
}

function isValidPos(pos: string): string | null {
  if (!pos || pos.trim().length === 0) return null;

  // 词性通常包含 . 或 v/n/adj/adv 等
  const posLower = pos.toLowerCase();
  const hasRecognizable = /[a-z]/.test(posLower);
  if (!hasRecognizable) return '词性不包含英文字母';

  // 检查是否过长（可能是翻译而非词性）
  if (pos.length > 30) return '词性字段可能过长';

  return null;
}

async function sampleQualityCheck(sampleSize: number): Promise<{ issues: QualityIssue[] }> {
  console.log(`  🎲 随机抽样 ${sampleSize} 个有例句的词条进行质量检查...`);

  const words = await prisma.word.findMany({
    where: {
      example: { not: null },
    },
    select: {
      id: true,
      word: true,
      example: true,
      exampleTranslation: true,
      phonetic: true,
      pos: true,
    },
  });

  // 随机抽样
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  const sampled = shuffled.slice(0, Math.min(sampleSize, shuffled.length));

  const issues: QualityIssue[] = [];

  for (const w of sampled) {
    const exampleIssue = w.example ? isValidExample(w.example, w.word) : '例句为空';
    if (exampleIssue) {
      issues.push({ id: w.id, word: w.word, field: 'example', issue: exampleIssue, currentValue: w.example });
    }

    if (w.exampleTranslation && w.exampleTranslation.trim().length === 0) {
      issues.push({ id: w.id, word: w.word, field: 'exampleTranslation', issue: '例句翻译为空', currentValue: w.exampleTranslation });
    }

    const phoneticIssue = w.phonetic ? isValidPhonetic(w.phonetic) : null;
    if (phoneticIssue) {
      issues.push({ id: w.id, word: w.word, field: 'phonetic', issue: phoneticIssue, currentValue: w.phonetic });
    }

    const posIssue = w.pos ? isValidPos(w.pos) : null;
    if (posIssue) {
      issues.push({ id: w.id, word: w.word, field: 'pos', issue: posIssue, currentValue: w.pos });
    }
  }

  console.log(`  已完成抽样检查，发现 ${issues.length} 个潜在问题`);
  return { issues };
}

async function main() {
  const outputFile = process.argv.includes('--output')
    ? process.argv[process.argv.indexOf('--output') + 1]
    : null;

  console.log('🔍 数据补全验证脚本\n');

  // === 统计覆盖率 ===
  console.log('📊 统计数据库覆盖率...');

  const wordTotal = await prisma.word.count();
  const wordWithExample = await prisma.word.count({ where: { example: { not: null } } });
  const wordWithPhonetic = await prisma.word.count({ where: { phonetic: { not: null } } });
  const wordWithPos = await prisma.word.count({ where: { pos: { not: null } } });
  const wordFullyComplete = await prisma.word.count({
    where: {
      example: { not: null },
      phonetic: { not: null },
      pos: { not: null },
      translation: { not: null },
      word: { not: '' },
    },
  });

  const publicTotal = await prisma.publicWord.count();
  const publicWithExample = await prisma.publicWord.count({ where: { example: { not: null } } });
  const publicWithPhonetic = await prisma.publicWord.count({ where: { phonetic: { not: null } } });
  const publicWithPos = await prisma.publicWord.count({ where: { pos: { not: null } } });
  const publicFullyComplete = await prisma.publicWord.count({
    where: {
      example: { not: null },
      phonetic: { not: null },
      pos: { not: null },
      translation: { not: '' },
      word: { not: '' },
    },
  });

  // === 质量检查 ===
  console.log('\n🔬 质量检查...');
  const qualityResult = await sampleQualityCheck(100);

  // === 构建报告 ===
  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    summary: {
      wordTable: {
        total: wordTotal,
        withExample: wordWithExample,
        withExamplePercent: wordTotal > 0 ? Math.round(wordWithExample / wordTotal * 100) : 0,
        withPhonetic: wordWithPhonetic,
        withPhoneticPercent: wordTotal > 0 ? Math.round(wordWithPhonetic / wordTotal * 100) : 0,
        withPos: wordWithPos,
        withPosPercent: wordTotal > 0 ? Math.round(wordWithPos / wordTotal * 100) : 0,
        fullyComplete: wordFullyComplete,
        fullyCompletePercent: wordTotal > 0 ? Math.round(wordFullyComplete / wordTotal * 100) : 0,
      },
      publicWordTable: {
        total: publicTotal,
        withExample: publicWithExample,
        withExamplePercent: publicTotal > 0 ? Math.round(publicWithExample / publicTotal * 100) : 0,
        withPhonetic: publicWithPhonetic,
        withPhoneticPercent: publicTotal > 0 ? Math.round(publicWithPhonetic / publicTotal * 100) : 0,
        withPos: publicWithPos,
        withPosPercent: publicTotal > 0 ? Math.round(publicWithPos / publicTotal * 100) : 0,
        fullyComplete: publicFullyComplete,
        fullyCompletePercent: publicTotal > 0 ? Math.round(publicFullyComplete / publicTotal * 100) : 0,
      },
    },
    qualityCheck: {
      examplesSampled: 100,
      issuesFound: qualityResult.issues.length,
      issues: qualityResult.issues,
    },
  };

  // === 输出报告 ===
  console.log('\n' + '='.repeat(70));
  console.log('📊 验证报告');
  console.log('='.repeat(70));

  console.log('\n📋 Word 表:');
  console.log(`  总计:       ${report.summary.wordTable.total}`);
  console.log(`  有例句:     ${report.summary.wordTable.withExample} (${report.summary.wordTable.withExamplePercent}%)`);
  console.log(`  有音标:     ${report.summary.wordTable.withPhonetic} (${report.summary.wordTable.withPhoneticPercent}%)`);
  console.log(`  有词性:     ${report.summary.wordTable.withPos} (${report.summary.wordTable.withPosPercent}%)`);
  console.log(`  完整词条:   ${report.summary.wordTable.fullyComplete} (${report.summary.wordTable.fullyCompletePercent}%)`);

  console.log('\n📋 PublicWord 表:');
  console.log(`  总计:       ${report.summary.publicWordTable.total}`);
  console.log(`  有例句:     ${report.summary.publicWordTable.withExample} (${report.summary.publicWordTable.withExamplePercent}%)`);
  console.log(`  有音标:     ${report.summary.publicWordTable.withPhonetic} (${report.summary.publicWordTable.withPhoneticPercent}%)`);
  console.log(`  有词性:     ${report.summary.publicWordTable.withPos} (${report.summary.publicWordTable.withPosPercent}%)`);
  console.log(`  完整词条:   ${report.summary.publicWordTable.fullyComplete} (${report.summary.publicWordTable.fullyCompletePercent}%)`);

  console.log(`\n🔬 质量检查 (抽样 ${report.qualityCheck.examplesSampled} 条):`);
  console.log(`  发现问题:   ${report.qualityCheck.issuesFound}`);
  if (report.qualityCheck.issues.length > 0) {
    console.log('  前 10 个问题:');
    for (const issue of report.qualityCheck.issues.slice(0, 10)) {
      console.log(`    - [${issue.word}] ${issue.field}: ${issue.issue} (当前值: "${(issue.currentValue || '').substring(0, 60)}")`);
    }
  }

  // === 生成验证结论 ===
  const exampleCov = report.summary.wordTable.withExamplePercent;
  const phoneticCov = report.summary.wordTable.withPhoneticPercent;
  const overallQuality = (exampleCov + phoneticCov) / 2;

  console.log('\n📈 验证结论:');
  if (overallQuality >= 80) {
    console.log('  ✅ 数据质量良好，覆盖率较高');
  } else if (overallQuality >= 60) {
    console.log('  ⚠️  数据质量一般，仍有提升空间');
  } else {
    console.log('  ❌ 数据质量不足，需要进一步补充');
  }

  console.log('='.repeat(70));

  // === 写入文件 ===
  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n📄 报告已保存至: ${outputFile}`);
  }

  // 返回状态码
  if (report.qualityCheck.issuesFound > 10) {
    console.log('\n⚠️  质量问题较多，建议复查');
  }

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('❌ 验证脚本执行失败:', e);
    process.exit(1);
  });

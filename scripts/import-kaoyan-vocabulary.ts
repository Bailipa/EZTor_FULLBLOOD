import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

const prisma = new PrismaClient();

function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomBytes = crypto.randomBytes(9);
  return Array(3)
    .fill(null)
    .map((_, si) =>
      Array(3)
        .fill(null)
        .map((_, ci) => chars[randomBytes[si * 3 + ci] % chars.length])
        .join('')
    )
    .join('-');
}

async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateShareCode();
    const existing = await prisma.sharedVocabulary.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error('Failed to generate unique code');
}

interface TatoebaPair {
  english: string;
  chinese: string;
}

function loadTatoebaPairs(filePath: string): Map<string, TatoebaPair[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const wordMap = new Map<string, TatoebaPair[]>();

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    if (parts.length < 2) continue;
    const english = parts[0].trim();
    const chinese = parts[1].trim();

    const words = english.toLowerCase().split(/\s+/);
    const uniqueWords = [...new Set(words)];
    for (const w of uniqueWords) {
      if (w.length < 2) continue;
      if (!/[a-z]/.test(w)) continue;
      if (!wordMap.has(w)) {
        wordMap.set(w, []);
      }
      const arr = wordMap.get(w)!;
      if (arr.length < 5) {
        arr.push({ english, chinese });
      }
    }
  }

  return wordMap;
}

interface ECDICTEntry {
  word: string;
  phonetic: string;
  translation: string;
  pos: string;
  tag: string;
}

function loadECDICT(filePath: string, filterTag: string): Map<string, ECDICTEntry> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = csv.parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  const result = new Map<string, ECDICTEntry>();
  for (const row of records) {
    const tag = row.tag || '';
    if (!tag.includes(filterTag)) continue;
    const word = (row.word || '').trim().toLowerCase();
    if (!word) continue;
    if (result.has(word)) continue;
    result.set(word, {
      word,
      phonetic: row.phonetic || '',
      translation: row.translation || '',
      pos: row.pos || '',
      tag,
    });
  }
  return result;
}

function pickBestExamples(
  word: string,
  tatoebaMap: Map<string, TatoebaPair[]>
): { example: string; exampleTranslation: string } | null {
  const pairs = tatoebaMap.get(word.toLowerCase());
  if (!pairs || pairs.length === 0) return null;

  const scored = pairs.map((p) => {
    const sentenceWords = p.english.toLowerCase().split(/\s+/);
    const wordCount = sentenceWords.length;
    const score =
      (wordCount >= 5 && wordCount <= 20 ? 10 : wordCount < 5 ? 3 : 5) +
      (p.english.includes(word) ? 5 : 0);
    return { pair: p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].pair;
  return {
    example: best.english,
    exampleTranslation: best.chinese,
  };
}

function cleanTranslation(raw: string): string {
  if (!raw) return '';
  return raw
    .split('\\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
    .join('\n');
}

async function supplementExamplesForExistingWords(tatoebaMap: Map<string, TatoebaPair[]>) {
  console.log('\n📝 Step 1: Supplementing example sentences for existing words...');

  const wordsWithoutExamples = await prisma.word.findMany({
    where: {
      OR: [
        { example: { equals: null } },
        { example: { equals: '' } },
      ],
    },
    select: { id: true, word: true },
  });

  console.log(`  Found ${wordsWithoutExamples.length} words without examples`);

  let supplemented = 0;
  const batchSize = 50;

  for (let i = 0; i < wordsWithoutExamples.length; i += batchSize) {
    const batch = wordsWithoutExamples.slice(i, i + batchSize);
    const updates: Promise<any>[] = [];

    for (const w of batch) {
      const example = pickBestExamples(w.word, tatoebaMap);
      if (!example) continue;

      updates.push(
        prisma.word.update({
          where: { id: w.id },
          data: {
            example: example.example,
            exampleTranslation: example.exampleTranslation,
          },
        })
      );
      supplemented++;
    }

    await Promise.all(updates);

    if ((i + batchSize) % 500 === 0 || i + batchSize >= wordsWithoutExamples.length) {
      console.log(`  Progress: ${Math.min(i + batchSize, wordsWithoutExamples.length)}/${wordsWithoutExamples.length} (supplemented: ${supplemented})`);
    }
  }

  console.log(`  ✅ Supplemented ${supplemented} words with examples`);

  const publicWordsWithoutExamples = await prisma.publicWord.findMany({
    where: {
      OR: [
        { example: { equals: null } },
        { example: { equals: '' } },
      ],
    },
    select: { id: true, word: true },
  });

  console.log(`  Found ${publicWordsWithoutExamples.length} public words without examples`);

  let publicSupplemented = 0;
  for (let i = 0; i < publicWordsWithoutExamples.length; i += batchSize) {
    const batch = publicWordsWithoutExamples.slice(i, i + batchSize);
    const updates: Promise<any>[] = [];

    for (const w of batch) {
      const example = pickBestExamples(w.word, tatoebaMap);
      if (!example) continue;

      updates.push(
        prisma.publicWord.update({
          where: { id: w.id },
          data: {
            example: example.example,
            exampleTranslation: example.exampleTranslation,
          },
        })
      );
      publicSupplemented++;
    }

    await Promise.all(updates);
  }

  console.log(`  ✅ Supplemented ${publicSupplemented} public words with examples`);
}

async function importKaoyanVocabulary(
  ecdictMap: Map<string, ECDICTEntry>,
  tatoebaMap: Map<string, TatoebaPair[]>
) {
  console.log(`\n📝 Step 2: Importing 考研 (Postgraduate) vocabulary (${ecdictMap.size} words)...`);

  let systemUser = await prisma.user.findUnique({ where: { username: 'system' } });
  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        username: 'system',
        password: 'system_password_not_for_login',
        isAdmin: true,
      },
    });
    console.log('  Created system user');
  }

  let reviewGroup = await prisma.reviewGroup.findFirst({
    where: { name: '考研英语词汇', userId: systemUser.id },
  });

  if (!reviewGroup) {
    reviewGroup = await prisma.reviewGroup.create({
      data: {
        id: crypto.randomUUID(),
        name: '考研英语词汇',
        userId: systemUser.id,
        updatedAt: new Date(),
      },
    });
    console.log(`  Created review group: 考研英语词汇 (ID: ${reviewGroup.id})`);
  } else {
    console.log(`  Review group already exists: 考研英语词汇 (ID: ${reviewGroup.id})`);
  }

  let imported = 0;
  let skipped = 0;
  let examplesAdded = 0;
  const batchSize = 50;
  const entries = Array.from(ecdictMap.values());

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);

    for (const entry of batch) {
      const normalizedWord = entry.word.toLowerCase().trim();
      const translation = cleanTranslation(entry.translation);

      if (!translation) {
        skipped++;
        continue;
      }

      const existingWord = await prisma.word.findUnique({
        where: {
          word_userId: {
            word: normalizedWord,
            userId: systemUser.id,
          },
        },
      });

      let wordId: string;

      if (existingWord) {
        wordId = existingWord.id;

        const needsUpdate =
          (!existingWord.phonetic && entry.phonetic) ||
          (!existingWord.pos && entry.pos) ||
          (!existingWord.example);

        if (needsUpdate) {
          const example = existingWord.example
            ? null
            : pickBestExamples(normalizedWord, tatoebaMap);

          await prisma.word.update({
            where: { id: wordId },
            data: {
              ...(entry.phonetic && !existingWord.phonetic ? { phonetic: entry.phonetic } : {}),
              ...(entry.pos && !existingWord.pos ? { pos: entry.pos } : {}),
              ...(example ? { example: example.example, exampleTranslation: example.exampleTranslation } : {}),
            },
          });
          if (example) examplesAdded++;
        }

        const existingLink = await prisma.reviewGroupWord.findUnique({
          where: {
            reviewGroupId_wordId: {
              reviewGroupId: reviewGroup.id,
              wordId,
            },
          },
        });

        if (!existingLink) {
          await prisma.reviewGroupWord.create({
            data: {
              id: crypto.randomUUID(),
              reviewGroupId: reviewGroup.id,
              wordId,
            },
          });
        }

        skipped++;
      } else {
        const example = pickBestExamples(normalizedWord, tatoebaMap);

        const newWord = await prisma.word.create({
          data: {
            id: crypto.randomUUID(),
            word: normalizedWord,
            phonetic: entry.phonetic || null,
            pos: entry.pos || null,
            translation,
            example: example?.example || null,
            exampleTranslation: example?.exampleTranslation || null,
            userId: systemUser.id,
            updatedAt: new Date(),
          },
        });

        wordId = newWord.id;

        await prisma.reviewGroupWord.create({
          data: {
            id: crypto.randomUUID(),
            reviewGroupId: reviewGroup.id,
            wordId,
          },
        });

        imported++;
        if (example) examplesAdded++;
      }
    }

    const processed = Math.min(i + batchSize, entries.length);
    if (processed % 500 === 0 || processed === entries.length) {
      console.log(`  Progress: ${processed}/${entries.length} (imported: ${imported}, skipped: ${skipped}, examples: ${examplesAdded})`);
    }
  }

  console.log(`  ✅ Import complete: ${imported} new, ${skipped} existing, ${examplesAdded} with examples`);

  const actualCount = await prisma.reviewGroupWord.count({
    where: { reviewGroupId: reviewGroup.id },
  });

  console.log(`  Actual words in group: ${actualCount}`);

  let existingDefault = await prisma.defaultVocabulary.findFirst({
    where: { name: '考研英语词汇' },
  });

  if (!existingDefault) {
    const shareCode = await generateUniqueCode();
    await prisma.sharedVocabulary.create({
      data: {
        id: crypto.randomUUID(),
        code: shareCode,
        name: '考研英语词汇',
        description: '考研英语大纲词汇，涵盖考研英语一、英语二全部词汇，约4800词',
        userId: systemUser.id,
        shareType: 'REVIEW_GROUP',
        reviewGroupId: reviewGroup.id,
        wordCount: actualCount,
        maxUses: null,
        expiresAt: null,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    await prisma.defaultVocabulary.create({
      data: {
        id: crypto.randomUUID(),
        name: '考研英语词汇',
        code: shareCode,
        description: '考研英语大纲词汇，涵盖考研英语一、英语二全部词汇，约4800词',
        groupId: reviewGroup.id,
        wordCount: actualCount,
        isActive: true,
        sortOrder: 10,
        updatedAt: new Date(),
      },
    });

    console.log(`  ✅ DefaultVocabulary created with share code: ${shareCode}`);
  } else {
    await prisma.defaultVocabulary.update({
      where: { id: existingDefault.id },
      data: { wordCount: actualCount, updatedAt: new Date() },
    });
    console.log(`  ✅ DefaultVocabulary updated, wordCount: ${actualCount}`);
  }
}

async function main() {
  const ecdictPath = process.argv[2] || '/tmp/ecdict.csv';
  const tatoebaPath = process.argv[3] || '/tmp/cmn.txt';

  if (!fs.existsSync(ecdictPath)) {
    console.error(`❌ ECDICT file not found: ${ecdictPath}`);
    console.error('Download from: https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv');
    process.exit(1);
  }

  if (!fs.existsSync(tatoebaPath)) {
    console.error(`❌ Tatoeba file not found: ${tatoebaPath}`);
    console.error('Download from: http://www.manythings.org/anki/cmn-eng.zip');
    process.exit(1);
  }

  console.log('📖 Loading Tatoeba sentence pairs...');
  const tatoebaMap = loadTatoebaPairs(tatoebaPath);
  console.log(`  Loaded sentences for ${tatoebaMap.size} unique words`);

  console.log('📖 Loading ECDICT 考研 vocabulary...');
  const kaoyanMap = loadECDICT(ecdictPath, 'ky');
  console.log(`  Found ${kaoyanMap.size} 考研 words`);

  await supplementExamplesForExistingWords(tatoebaMap);
  await importKaoyanVocabulary(kaoyanMap, tatoebaMap);

  console.log('\n✅ All done!');

  const totalWords = await prisma.word.count();
  const wordsWithExamples = await prisma.word.count({
    where: { example: { not: null } },
  });
  console.log(`📊 Total: ${totalWords} words, ${wordsWithExamples} with examples`);
}

main()
  .catch((e) => {
    console.error('❌ Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

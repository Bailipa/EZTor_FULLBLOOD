/**
 * Backfill/migrate existing private Word rows to "mirror" PublicWord:
 * - Link Word.publicWordId when a matching PublicWord exists
 * - Null out duplicated definition fields (translation/phonetic/pos/example/...) when they match PublicWord
 *
 * Usage:
 *   npx tsx scripts/mirror-private-words.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function norm(word: string): string {
  return String(word || '').toLowerCase().trim();
}

function isBlank(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

function sameText(a: unknown, b: unknown): boolean {
  const aVal = isBlank(a) ? null : String(a);
  const bVal = isBlank(b) ? null : String(b);
  return aVal === bVal;
}

async function main() {
  const BATCH_SIZE = 500;
  let cursor: string | undefined;

  let scanned = 0;
  let linked = 0;
  let cleared = 0;
  let updated = 0;

  // Process deterministically to avoid skipping/duplication.
  while (true) {
    const batch = await prisma.word.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        word: true,
        phonetic: true,
        pos: true,
        translation: true,
        example: true,
        exampleTranslation: true,
        publicWordId: true,
        sourceType: true
      }
    });

    if (batch.length === 0) break;
    scanned += batch.length;
    cursor = batch[batch.length - 1].id;

    const normalizedWords = Array.from(new Set(batch.map(w => norm(w.word)).filter(Boolean)));
    if (normalizedWords.length === 0) continue;

    const publicWords = await prisma.publicWord.findMany({
      where: { word: { in: normalizedWords } },
      select: {
        id: true,
        word: true,
        phonetic: true,
        pos: true,
        translation: true,
        example: true,
        exampleTranslation: true
      }
    });

    const publicWordByWord = new Map(publicWords.map(pw => [norm(pw.word), pw]));

    for (const userWord of batch) {
      const key = norm(userWord.word);
      const publicWord = publicWordByWord.get(key);
      if (!publicWord) continue;

      const nextData: Record<string, any> = {};
      let changed = false;

      if (userWord.publicWordId !== publicWord.id) {
        nextData.publicWordId = publicWord.id;
        linked++;
        changed = true;
      }

      const nextPhonetic = sameText(userWord.phonetic, publicWord.phonetic) ? null : userWord.phonetic;
      const nextPos = sameText(userWord.pos, publicWord.pos) ? null : userWord.pos;
      const nextTranslation = sameText(userWord.translation, publicWord.translation) || isBlank(userWord.translation)
        ? null
        : userWord.translation;
      const nextExample = sameText(userWord.example, publicWord.example) ? null : userWord.example;
      const nextExampleTranslation = sameText(userWord.exampleTranslation, publicWord.exampleTranslation)
        ? null
        : userWord.exampleTranslation;

      if (userWord.phonetic !== nextPhonetic) {
        nextData.phonetic = nextPhonetic;
        changed = true;
      }
      if (userWord.pos !== nextPos) {
        nextData.pos = nextPos;
        changed = true;
      }
      if (userWord.translation !== nextTranslation) {
        nextData.translation = nextTranslation;
        changed = true;
      }
      if (userWord.example !== nextExample) {
        nextData.example = nextExample;
        changed = true;
      }
      if (userWord.exampleTranslation !== nextExampleTranslation) {
        nextData.exampleTranslation = nextExampleTranslation;
        changed = true;
      }

      const hasOverrides =
        !isBlank(nextPhonetic) ||
        !isBlank(nextPos) ||
        !isBlank(nextTranslation) ||
        !isBlank(nextExample) ||
        !isBlank(nextExampleTranslation);

      if (!hasOverrides && userWord.sourceType === 'USER') {
        // If it now mirrors public data with no overrides, mark as PUBLIC.
        nextData.sourceType = 'PUBLIC';
        changed = true;
      }

      if (!changed) continue;

      if (
        'phonetic' in nextData ||
        'pos' in nextData ||
        'translation' in nextData ||
        'example' in nextData ||
        'exampleTranslation' in nextData
      ) {
        cleared++;
      }

      await prisma.word.update({
        where: { id: userWord.id },
        data: nextData
      });

      updated++;
    }
  }

  console.log(
    JSON.stringify(
      { scanned, updated, linked, cleared },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


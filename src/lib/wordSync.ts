import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface SyncResult {
  synced: number;
  skipped: number;
  errors: string[];
}

function normalizeWord(word: string): string {
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

export async function syncUserWordWithPublic(
  userId: string,
  word: string
): Promise<{ updated: boolean; reason: string }> {
  try {
    const userWord = await prisma.word.findFirst({
      where: { userId, word: normalizeWord(word) }
    });

    if (!userWord) {
      return { updated: false, reason: 'USER_WORD_NOT_FOUND' };
    }

    const publicWord = await prisma.publicWord.findFirst({
      where: { word: normalizeWord(word) }
    });

    if (!publicWord) {
      return { updated: false, reason: 'PUBLIC_WORD_NOT_FOUND' };
    }

    const nextData: Record<string, unknown> = {
      publicWordId: publicWord.id
    };

    // Mirror mode: if the private definitions are blank or equal to public, null them out to save space.
    if (sameText(userWord.phonetic, publicWord.phonetic) || isBlank(userWord.phonetic)) nextData.phonetic = null;
    if (sameText(userWord.pos, publicWord.pos) || isBlank(userWord.pos)) nextData.pos = null;
    if (sameText(userWord.translation, publicWord.translation) || isBlank(userWord.translation)) nextData.translation = null;
    if (sameText(userWord.example, publicWord.example) || isBlank(userWord.example)) nextData.example = null;
    if (sameText(userWord.exampleTranslation, publicWord.exampleTranslation) || isBlank(userWord.exampleTranslation)) {
      nextData.exampleTranslation = null;
    }

    const updatedWord = await prisma.word.update({
      where: { id: userWord.id },
      data: nextData
    });

    const changed =
      updatedWord.publicWordId === publicWord.id &&
      (nextData.phonetic === null ||
        nextData.pos === null ||
        nextData.translation === null ||
        nextData.example === null ||
        nextData.exampleTranslation === null);

    return { updated: changed, reason: changed ? 'MIRRORED_AND_CLEARED' : 'ALREADY_MIRRORED' };
  } catch (error) {
    logger.error({ err: error, word }, '[WordSync] Error syncing word');
    return { updated: false, reason: 'ERROR' };
  }
}

export async function syncAllUserWordsWithPublic(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    synced: 0,
    skipped: 0,
    errors: []
  };

  try {
    const userWords = await prisma.word.findMany({
      where: { userId },
      select: { id: true, word: true, phonetic: true, pos: true, translation: true, example: true, exampleTranslation: true, publicWordId: true }
    });
    if (userWords.length === 0) return result;

    const wordStrings = userWords.map(uw => normalizeWord(uw.word));
    const publicWords = await prisma.publicWord.findMany({
      where: { word: { in: wordStrings } },
      select: { id: true, word: true, phonetic: true, pos: true, translation: true, example: true, exampleTranslation: true }
    });
    const publicWordMap = new Map(publicWords.map(pw => [normalizeWord(pw.word), pw]));

    const updateGroups = new Map<string, { ids: string[]; data: Record<string, unknown> }>();

    for (const uw of userWords) {
      const pw = publicWordMap.get(normalizeWord(uw.word));
      if (!pw) {
        result.skipped++;
        continue;
      }

      const nextData: Record<string, unknown> = {};
      let needsUpdate = false;

      if (uw.publicWordId !== pw.id) {
        nextData.publicWordId = pw.id;
        needsUpdate = true;
      }

      if (sameText(uw.phonetic, pw.phonetic) || isBlank(uw.phonetic)) {
        if (uw.phonetic !== null) { nextData.phonetic = null; needsUpdate = true; }
      }
      if (sameText(uw.pos, pw.pos) || isBlank(uw.pos)) {
        if (uw.pos !== null) { nextData.pos = null; needsUpdate = true; }
      }
      if (sameText(uw.translation, pw.translation) || isBlank(uw.translation)) {
        if (uw.translation !== null) { nextData.translation = null; needsUpdate = true; }
      }
      if (sameText(uw.example, pw.example) || isBlank(uw.example)) {
        if (uw.example !== null) { nextData.example = null; needsUpdate = true; }
      }
      if (sameText(uw.exampleTranslation, pw.exampleTranslation) || isBlank(uw.exampleTranslation)) {
        if (uw.exampleTranslation !== null) { nextData.exampleTranslation = null; needsUpdate = true; }
      }

      if (!needsUpdate) {
        result.skipped++;
        continue;
      }

      const sig = JSON.stringify(nextData);
      if (!updateGroups.has(sig)) {
        updateGroups.set(sig, { ids: [], data: nextData });
      }
      updateGroups.get(sig)!.ids.push(uw.id);
      result.synced++;
    }

    for (const [, group] of updateGroups) {
      await prisma.word.updateMany({
        where: { id: { in: group.ids } },
        data: group.data
      });
    }

    logger.info({ userId, result }, '[WordSync] Sync completed');
    return result;
  } catch (error) {
    logger.error({ err: error }, '[WordSync] Error in batch sync');
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
}

export async function checkAndSyncOnQuery(
  userId: string,
  words: string[]
): Promise<Map<string, unknown>> {
  const syncUpdates = new Map<string, unknown>();

  try {
    // Mirror mode: the UI reads definitions from PublicWord automatically via join.
    // Keep this hook as a lightweight "ensure linkage" step (no content copying).
    const normalized = words.map(normalizeWord).filter(Boolean);
    if (normalized.length === 0) return syncUpdates;

    const publicWords = await prisma.publicWord.findMany({
      where: { word: { in: normalized } },
      select: { id: true, word: true, phonetic: true, pos: true, translation: true, example: true, exampleTranslation: true }
    });
    const publicWordMap = new Map(publicWords.map(pw => [normalizeWord(pw.word), pw]));

    const userWords = await prisma.word.findMany({
      where: { userId, word: { in: normalized } }
    });

    const syncIdsByPublicWordId = new Map<string, { uwIds: string[]; publicWord: typeof publicWords[0] }>();

    for (const uw of userWords) {
      const pw = publicWordMap.get(normalizeWord(uw.word));
      if (!pw) continue;
      if (uw.publicWordId === pw.id) continue;

      if (!syncIdsByPublicWordId.has(pw.id)) {
        syncIdsByPublicWordId.set(pw.id, { uwIds: [], publicWord: pw });
      }
      syncIdsByPublicWordId.get(pw.id)!.uwIds.push(uw.id);
    }

    for (const [, group] of syncIdsByPublicWordId) {
      const pw = group.publicWord;
      await prisma.word.updateMany({
        where: { id: { in: group.uwIds } },
        data: { publicWordId: pw.id }
      });

      syncUpdates.set(normalizeWord(pw.word), {
        word: pw.word,
        phonetic: pw.phonetic || '',
        pos: pw.pos || '',
        translation: pw.translation || '',
        example: pw.example || '',
        exampleTranslation: pw.exampleTranslation || '',
        mirroredFromPublic: true
      });
    }

    return syncUpdates;
  } catch (error) {
    logger.error({ err: error }, '[WordSync] Error in checkAndSyncOnQuery');
    return syncUpdates;
  }
}

export async function deduplicateUserWords(userId: string): Promise<{
  duplicates: number;
  kept: string[];
  removed: string[];
}> {
  const result = {
    duplicates: 0,
    kept: [] as string[],
    removed: [] as string[]
  };

  try {
    const words = await prisma.word.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });

    const wordMap = new Map<string, typeof words[0][]>();
    
    for (const word of words) {
      const key = word.word.toLowerCase();
      if (!wordMap.has(key)) {
        wordMap.set(key, []);
      }
      wordMap.get(key)!.push(word);
    }

    for (const [wordKey, duplicates] of wordMap) {
      if (duplicates.length > 1) {
        result.duplicates += duplicates.length - 1;
        result.kept.push(duplicates[0].word);

        const toRemove = duplicates.slice(1).map(w => w.id);
        result.removed.push(...duplicates.slice(1).map(w => w.word));

        await prisma.reviewGroupWord.deleteMany({
          where: { wordId: { in: toRemove } }
        });

        await prisma.word.deleteMany({
          where: { id: { in: toRemove } }
        });

        logger.info({ wordKey, removedCount: toRemove.length }, '[WordSync] Deduplicated');
      }
    }

    return result;
  } catch (error) {
    logger.error({ err: error }, '[WordSync] Error in deduplication');
    return result;
  }
}

export async function getSyncStats(userId: string): Promise<{
  totalUserWords: number;
  syncedWithPublic: number;
  pendingSync: number;
  userOnlyWords: number;
}> {
  try {
    const userWords = await prisma.word.findMany({
      where: { userId },
      select: { word: true, publicWordId: true }
    });

    const syncedWithPublic = userWords.filter(uw => !!uw.publicWordId).length;

    return {
      totalUserWords: userWords.length,
      syncedWithPublic,
      pendingSync: 0,
      userOnlyWords: userWords.length - syncedWithPublic
    };
  } catch (error) {
    logger.error({ err: error }, '[WordSync] Error getting sync stats');
    return {
      totalUserWords: 0,
      syncedWithPublic: 0,
      pendingSync: 0,
      userOnlyWords: 0
    };
  }
}

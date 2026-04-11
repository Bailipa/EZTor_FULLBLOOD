import prisma from '@/lib/prisma';
import { calculateQualityScore } from './qualityScoring';

interface SyncResult {
  synced: number;
  skipped: number;
  errors: string[];
}

interface WordSyncData {
  word: string;
  phonetic: string | null;
  pos: string | null;
  translation: string;
  example: string | null;
  exampleTranslation: string | null;
  qualityScore: number;
}

export async function syncUserWordWithPublic(
  userId: string,
  word: string
): Promise<{ updated: boolean; reason: string }> {
  try {
    const userWord = await prisma.word.findFirst({
      where: { userId, word: word.toLowerCase() }
    });

    if (!userWord) {
      return { updated: false, reason: 'USER_WORD_NOT_FOUND' };
    }

    const publicWord = await prisma.publicWord.findFirst({
      where: { word: word.toLowerCase() }
    });

    if (!publicWord) {
      return { updated: false, reason: 'PUBLIC_WORD_NOT_FOUND' };
    }

    const userQuality = calculateQualityScore(
      userWord.word,
      userWord.phonetic,
      userWord.pos,
      userWord.translation,
      userWord.example,
      userWord.exampleTranslation
    );

    if (publicWord.qualityScore > userQuality.score) {
      await prisma.word.update({
        where: { id: userWord.id },
        data: {
          phonetic: publicWord.phonetic,
          pos: publicWord.pos,
          translation: publicWord.translation,
          example: publicWord.example,
          exampleTranslation: publicWord.exampleTranslation,
        }
      });
      return { updated: true, reason: 'QUALITY_IMPROVED' };
    }

    return { updated: false, reason: 'USER_QUALITY_HIGHER_OR_EQUAL' };
  } catch (error) {
    console.error(`[WordSync] Error syncing word "${word}":`, error);
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
      select: { word: true }
    });

    const publicWords = await prisma.publicWord.findMany({
      where: {
        word: { in: userWords.map(w => w.word) }
      }
    });

    const publicWordMap = new Map(
      publicWords.map(pw => [pw.word.toLowerCase(), pw])
    );

    for (const userWord of userWords) {
      const publicWord = publicWordMap.get(userWord.word.toLowerCase());
      
      if (!publicWord) {
        result.skipped++;
        continue;
      }

      const syncResult = await syncUserWordWithPublic(userId, userWord.word);
      
      if (syncResult.updated) {
        result.synced++;
      } else {
        result.skipped++;
      }
    }

    console.log(`[WordSync] Sync completed for user ${userId}:`, result);
    return result;
  } catch (error) {
    console.error(`[WordSync] Error in batch sync:`, error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
}

export async function checkAndSyncOnQuery(
  userId: string,
  words: string[]
): Promise<Map<string, any>> {
  const syncUpdates = new Map<string, any>();

  try {
    const userWords = await prisma.word.findMany({
      where: {
        userId,
        word: { in: words.map(w => w.toLowerCase()) }
      }
    });

    const publicWords = await prisma.publicWord.findMany({
      where: {
        word: { in: words.map(w => w.toLowerCase()) }
      }
    });

    const userWordMap = new Map(
      userWords.map(uw => [uw.word.toLowerCase(), uw])
    );

    const publicWordMap = new Map(
      publicWords.map(pw => [pw.word.toLowerCase(), pw])
    );

    for (const word of words) {
      const wordLower = word.toLowerCase();
      const userWord = userWordMap.get(wordLower);
      const publicWord = publicWordMap.get(wordLower);

      if (!userWord || !publicWord) {
        continue;
      }

      const userQuality = calculateQualityScore(
        userWord.word,
        userWord.phonetic,
        userWord.pos,
        userWord.translation,
        userWord.example,
        userWord.exampleTranslation
      );

      if (publicWord.qualityScore > userQuality.score) {
        const updatedWord = await prisma.word.update({
          where: { id: userWord.id },
          data: {
            phonetic: publicWord.phonetic,
            pos: publicWord.pos,
            translation: publicWord.translation,
            example: publicWord.example,
            exampleTranslation: publicWord.exampleTranslation,
          }
        });

        syncUpdates.set(wordLower, {
          word: updatedWord.word,
          phonetic: updatedWord.phonetic || '',
          pos: updatedWord.pos || '',
          translation: updatedWord.translation,
          example: updatedWord.example || '',
          exampleTranslation: updatedWord.exampleTranslation || '',
          syncedFromPublic: true
        });

        console.log(`[WordSync] Auto-synced "${word}" for user ${userId}`);
      }
    }

    return syncUpdates;
  } catch (error) {
    console.error('[WordSync] Error in checkAndSyncOnQuery:', error);
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

        console.log(`[WordSync] Deduplicated "${wordKey}": kept 1, removed ${toRemove.length}`);
      }
    }

    return result;
  } catch (error) {
    console.error('[WordSync] Error in deduplication:', error);
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
      select: { word: true }
    });

    const publicWords = await prisma.publicWord.findMany({
      where: {
        word: { in: userWords.map(w => w.word) }
      },
      select: { word: true, qualityScore: true }
    });

    const publicWordSet = new Set(publicWords.map(pw => pw.word.toLowerCase()));

    let syncedWithPublic = 0;
    let pendingSync = 0;

    for (const uw of userWords) {
      if (publicWordSet.has(uw.word.toLowerCase())) {
        syncedWithPublic++;
      }
    }

    return {
      totalUserWords: userWords.length,
      syncedWithPublic,
      pendingSync: 0,
      userOnlyWords: userWords.length - syncedWithPublic
    };
  } catch (error) {
    console.error('[WordSync] Error getting sync stats:', error);
    return {
      totalUserWords: 0,
      syncedWithPublic: 0,
      pendingSync: 0,
      userOnlyWords: 0
    };
  }
}

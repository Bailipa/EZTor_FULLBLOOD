import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { checkAndSyncOnQuery } from '@/lib/wordSync';

export interface CachedWord {
  word: string;
  phonetic: string;
  pos: string;
  translation: string;
  example: string;
  exampleTranslation: string;
  fromCache: boolean;
}

export class CacheService {
  private readonly session: any;
  private readonly inputWordMap: Map<string, string>;

  constructor(session: any, words: string[]) {
    this.session = session;
    this.inputWordMap = new Map<string, string>();
    words.forEach(word => {
      this.inputWordMap.set(word.toLowerCase(), word);
    });
  }

  async getCachedWords(normalizedWords: string[]): Promise<{ cachedWords: any[], cachedWordStrings: string[] }> {
    // 查找数据库中已经存在的单词
    const cachedWords = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT * FROM Word
        WHERE userId = ${this.session.user.id}
          AND lower(word) IN (${Prisma.join(normalizedWords)})
      `
    );

    const cachedWordStrings = cachedWords.map((cw: any) => String(cw.word).toLowerCase());
    return { cachedWords, cachedWordStrings };
  }

  async updateIncompleteCachedWords(cachedWords: any[]): Promise<any[]> {
    // 检查用户私有库中数据不完整的单词，尝试从公共词库获取更好的数据
    // 只有当用户数据完全没有例句时才更新，避免覆盖用户可能的自定义修改
    const incompleteCachedWords = cachedWords.filter((cw: any) => 
      !cw.example || cw.example.trim() === ''
    );
    
    if (incompleteCachedWords.length > 0) {
      const incompleteWordStrings = incompleteCachedWords
        .map((cw: any) => String(cw.word).toLowerCase().trim())
        .filter(Boolean);
      const potentialBetterWords = await prisma.publicWord.findMany({
        where: {
          word: { in: incompleteWordStrings },
          example: { not: null }
        }
      });
      
      const betterWordsMap = new Map<string, any>();
      for (const pw of potentialBetterWords) {
        if (pw.example && pw.example.trim() !== '') {
          const cachedVersion = incompleteCachedWords.find((cw: any) => String(cw.word).toLowerCase() === pw.word);
          if (cachedVersion) {
            const hasNoExample = !cachedVersion.example || cachedVersion.example.trim() === '';
            if (hasNoExample) {
              betterWordsMap.set(pw.word, pw);
            }
          }
        }
      }
      
      for (const [word, betterWord] of betterWordsMap) {
        try {
          const cachedWord = cachedWords.find((cw: any) => String(cw.word).toLowerCase() === word);
          if (!cachedWord) continue;
          
          await prisma.word.update({
            where: { id: cachedWord.id },
            data: {
              phonetic: betterWord.phonetic || cachedWord.phonetic,
              pos: betterWord.pos || cachedWord.pos,
              translation: betterWord.translation || cachedWord.translation,
              example: betterWord.example,
              exampleTranslation: betterWord.exampleTranslation
            }
          });
          
          const cachedIndex = cachedWords.findIndex(cw => cw.word === word);
          if (cachedIndex !== -1) {
            cachedWords[cachedIndex] = {
              ...cachedWords[cachedIndex],
              phonetic: betterWord.phonetic || cachedWords[cachedIndex].phonetic,
              pos: betterWord.pos || cachedWords[cachedIndex].pos,
              translation: betterWord.translation || cachedWords[cachedIndex].translation,
              example: betterWord.example,
              exampleTranslation: betterWord.exampleTranslation
            };
          }
          console.log(`[BetterData] Updated "${word}" from public cache for user ${this.session.user.id}`);
        } catch (updateErr) {
          console.error(`Failed to update word ${word}:`, updateErr);
        }
      }
    }
    
    return cachedWords;
  }

  async getPublicCachedWords(missingFromUserWords: string[]): Promise<{ publicCachedWords: any[], publicCachedWordStrings: string[] }> {
    let publicCachedWords: any[] = [];
    if (missingFromUserWords.length > 0) {
      publicCachedWords = await prisma.publicWord.findMany({
        where: {
          word: {
            in: missingFromUserWords
          }
        }
      });
    }

    const publicCachedWordStrings = publicCachedWords.map(w => w.word);
    return { publicCachedWords, publicCachedWordStrings };
  }

  async copyPublicWordsToUserDb(publicCachedWords: any[], targetGroupId?: string): Promise<void> {
    if (publicCachedWords.length > 0) {
      try {
        const newlyCreatedWords = await Promise.all(
          publicCachedWords.map(w => 
            prisma.word.upsert({
              where: {
                word_userId: {
                  word: w.word,
                  userId: this.session.user.id
                }
              },
              update: {
                word: w.word,
                translation: w.translation,
                phonetic: w.phonetic,
                pos: w.pos,
                example: w.example,
                exampleTranslation: w.exampleTranslation,
                updatedAt: new Date()
              },
              create: {
                id: randomUUID(),
                word: w.word,
                translation: w.translation,
                phonetic: w.phonetic,
                pos: w.pos,
                example: w.example,
                exampleTranslation: w.exampleTranslation,
                userId: this.session.user.id,
                updatedAt: new Date(),
              }
            }).catch(() => null)
          )
        );

        // 如果指定了目标分组，将这些从公共库复制来的词加入分组
        if (targetGroupId) {
          for (const w of newlyCreatedWords.filter(Boolean)) {
            try {
              await prisma.reviewGroupWord.create({
                data: { id: randomUUID(), reviewGroupId: targetGroupId, wordId: (w as any).id }
              });
            } catch (e: any) {
              if (e.code !== 'P2002') console.error("Failed to add to group:", e);
            }
          }
        }
      } catch (e) {
        console.error("Failed to copy public words to user db", e);
      }
    }
  }

  async updateCacheTimestamps(cachedWordStrings: string[], targetGroupId?: string): Promise<void> {
    if (cachedWordStrings.length > 0) {
      try {
        await prisma.word.updateMany({
          where: { 
            userId: this.session.user.id,
            word: { in: cachedWordStrings } 
          },
          data: { updatedAt: new Date() }
        });

        // 如果指定了目标分组，将这些已在私有库的词加入分组
        if (targetGroupId) {
          for (const word of cachedWordStrings) {
            try {
              const wordRecord = await prisma.word.findUnique({
                where: {
                  word_userId: {
                    word,
                    userId: this.session.user.id
                  }
                }
              });
              if (wordRecord) {
                await prisma.reviewGroupWord.create({
                  data: { id: randomUUID(), reviewGroupId: targetGroupId, wordId: wordRecord.id }
                });
              }
            } catch (e: any) {
              if (e.code !== 'P2002') console.error("Failed to add cached word to group:", e);
            }
          }
        }
      } catch (updateErr) {
        console.error("Failed to update cache timestamps or add to group:", updateErr);
      }
    }
  }

  async autoSync(cachedWordStrings: string[], formattedCachedResults: CachedWord[]): Promise<CachedWord[]> {
    if (cachedWordStrings.length > 0) {
      try {
        const syncUpdates = await checkAndSyncOnQuery(this.session.user.id, cachedWordStrings);
        
        for (const [wordKey, updatedData] of syncUpdates) {
          const existingIndex = formattedCachedResults.findIndex(
            r => r.word.toLowerCase() === wordKey
          );
          if (existingIndex !== -1) {
            formattedCachedResults[existingIndex] = {
              ...formattedCachedResults[existingIndex],
              ...updatedData,
              fromCache: true
            };
          }
        }
      } catch (syncErr) {
        console.error('[Translate] Auto-sync error:', syncErr);
      }
    }
    return formattedCachedResults;
  }

  formatCachedResults(cachedWords: any[], publicCachedWords: any[], specialResults: any[]): CachedWord[] {
    return [
      ...cachedWords.map(cw => ({
        word: this.inputWordMap.get(cw.word.toLowerCase()) || cw.word,
        phonetic: cw.phonetic || '',
        pos: cw.pos || '',
        translation: cw.translation,
        example: cw.example || '',
        exampleTranslation: cw.exampleTranslation || '',
        fromCache: true
      })),
      ...publicCachedWords.map(pw => ({
        word: this.inputWordMap.get(pw.word.toLowerCase()) || pw.word,
        phonetic: pw.phonetic || '',
        pos: pw.pos || '',
        translation: pw.translation,
        example: pw.example || '',
        exampleTranslation: pw.exampleTranslation || '',
        fromCache: true
      })),
      ...specialResults.map(result => ({
        word: this.inputWordMap.get(result.word.toLowerCase()) || result.word,
        phonetic: result.phonetic || '',
        pos: result.pos || '',
        translation: result.translation,
        example: result.example || '',
        exampleTranslation: result.exampleTranslation || '',
        fromCache: false
      }))
    ];
  }

  orderResultsByInput(words: string[], formattedCachedResults: CachedWord[]): CachedWord[] {
    const orderedCachedResults: CachedWord[] = [];
    const resultMap = new Map<string, CachedWord>();
    formattedCachedResults.forEach(result => {
      resultMap.set(result.word.toLowerCase(), result);
    });
    
    // 按照原始输入顺序遍历，从map中取出对应的结果
    words.forEach(word => {
      const normalizedWord = word.toLowerCase();
      if (resultMap.has(normalizedWord)) {
        orderedCachedResults.push(resultMap.get(normalizedWord)!);
        resultMap.delete(normalizedWord);
      }
    });
    
    // 处理剩下的结果（如果有的话）
    resultMap.forEach(result => {
      orderedCachedResults.push(result);
    });

    return orderedCachedResults;
  }
}

import prisma from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { calculateQualityScore } from '@/lib/qualityScoring';
import { cascadePublicWordToPrivate } from '@/lib/publicWordCascade';

export interface WordData {
  word: string;
  phonetic: string | null;
  pos: string | null;
  translation: string;
  example: string | null;
  exampleTranslation: string | null;
}

export default class PublicWordService {
  private readonly userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async saveWordToPublicLibrary(wordData: WordData): Promise<void> {
    try {
      const qualityResult = calculateQualityScore(
        wordData.word,
        wordData.phonetic,
        wordData.pos,
        wordData.translation,
        wordData.example,
        wordData.exampleTranslation
      );

      // 使用upsert + 质量评分条件，避免并发覆盖问题
      // 只有当新数据质量更高时才更新
      const existingPublicWord = await prisma.publicWord.findUnique({
        where: { word: wordData.word }
      });

      if (!existingPublicWord) {
        // 不存在则创建
        try {
          await prisma.publicWord.create({
            data: {
              id: randomUUID(),
              word: wordData.word,
              translation: wordData.translation,
              phonetic: wordData.phonetic || null,
              pos: wordData.pos || null,
              example: wordData.example || null,
              exampleTranslation: wordData.exampleTranslation || null,
              qualityScore: qualityResult.score,
              updatedAt: new Date(),
            }
          });

          await cascadePublicWordToPrivate({
            word: wordData.word,
            translation: wordData.translation,
            phonetic: wordData.phonetic || null,
            pos: wordData.pos || null,
            example: wordData.example || null,
            exampleTranslation: wordData.exampleTranslation || null
          });
        } catch (createErr: any) {
          // 并发创建冲突，忽略（另一个请求已经创建）
          if (createErr.code !== 'P2002') {
            console.error("Failed to create public word:", createErr);
          }
        }
      } else if (qualityResult.score > existingPublicWord.qualityScore) {
        // 只有质量更高时才更新，使用version作为乐观锁
        try {
          const updateResult = await prisma.publicWord.updateMany({
            where: { 
              word: wordData.word,
              version: existingPublicWord.version  // 乐观锁
            },
            data: {
              translation: wordData.translation,
              phonetic: wordData.phonetic || null,
              pos: wordData.pos || null,
              example: wordData.example || null,
              exampleTranslation: wordData.exampleTranslation || null,
              qualityScore: qualityResult.score,
              version: { increment: 1 }
            }
          });
          if (updateResult.count === 0) {
            console.log(`[PublicWord] Concurrent update detected for "${wordData.word}", skipped`);
          } else {
            await cascadePublicWordToPrivate({
              word: wordData.word,
              translation: wordData.translation,
              phonetic: wordData.phonetic || null,
              pos: wordData.pos || null,
              example: wordData.example || null,
              exampleTranslation: wordData.exampleTranslation || null
            });
          }
        } catch (updateErr) {
          console.error("Failed to update public word:", updateErr);
        }
      }
    } catch (publicDbErr: any) {
      console.error("Failed to save to public word:", publicDbErr);
    }
  }

  async getPublicWords(words: string[]): Promise<any[]> {
    if (words.length === 0) {
      return [];
    }

    return await prisma.publicWord.findMany({
      where: {
        word: {
          in: words
        }
      }
    });
  }

  async getWordsNeedingRefresh(publicCachedWords: any[]): Promise<string[]> {
    return publicCachedWords
      .filter((pw: any) => !pw.translation || pw.translation.trim() === '' || !pw.pos)
      .map((pw: any) => pw.word);
  }
}

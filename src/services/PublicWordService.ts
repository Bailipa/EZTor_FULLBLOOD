import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { calculateQualityScore } from '@/lib/qualityScoring';
import { cascadePublicWordToPrivate } from '@/lib/publicWordCascade';
import { logger } from '@/lib/logger';

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

  async saveWordToPublicLibrary(wordData: WordData): Promise<string | null> {
    let publicWordId: string | null = null;
    try {
      const qualityResult = calculateQualityScore(
        wordData.word,
        wordData.phonetic,
        wordData.pos,
        wordData.translation,
        wordData.example,
        wordData.exampleTranslation
      );

      const existingPublicWord = await prisma.publicWord.findUnique({
        where: { word: wordData.word }
      });

      if (!existingPublicWord) {
        try {
          const created = await prisma.publicWord.create({
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
          publicWordId = created.id;

          await cascadePublicWordToPrivate({
            word: wordData.word,
            translation: wordData.translation,
            phonetic: wordData.phonetic || null,
            pos: wordData.pos || null,
            example: wordData.example || null,
            exampleTranslation: wordData.exampleTranslation || null
          });
        } catch (err: unknown) {
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
            logger.error({ err }, "Failed to create public word");
          }
        }
      } else if (qualityResult.score > existingPublicWord.qualityScore) {
        try {
          const updateResult = await prisma.publicWord.updateMany({
            where: {
              word: wordData.word,
              version: existingPublicWord.version
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
            logger.info({ word: wordData.word }, '[PublicWord] Concurrent update detected, skipped');
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
          logger.error({ err: updateErr }, "Failed to update public word");
        }
      }

      if (!publicWordId) {
        const pw = await prisma.publicWord.findUnique({ where: { word: wordData.word } });
        publicWordId = pw?.id || null;
      }
    } catch (err: unknown) {
      logger.error({ err }, "Failed to save to public word");
    }

    return publicWordId;
  }

  async getPublicWords(words: string[]): Promise<WordData[]> {
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

  async getWordsNeedingRefresh(publicCachedWords: Record<string, unknown>[]): Promise<string[]> {
    return publicCachedWords
      .filter(pw => !pw['translation'] || String(pw['translation']).trim() === '' || !pw['pos'])
      .map(pw => pw['word'] as string);
  }
}

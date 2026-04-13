import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { handleApiError, createErrorResponse } from '@/lib/apiErrorHandler';
import { isValidShareCode } from '@/lib/share/codeGenerator';

interface WordData {
  word: string;
  phonetic: string | null;
  pos: string | null;
  translation: string;
  example: string | null;
  exampleTranslation: string | null;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse('请先登录', 401);
    }

    const userId = session.user.id;
    const body = await req.json();
    const { code, customName, targetGroupId, createNewGroup = true, skipExisting = true } = body;

    if (!code || !isValidShareCode(code)) {
      return NextResponse.json(
        { success: false, error: 'INVALID_FORMAT', message: '密钥格式无效' },
        { status: 400 }
      );
    }

    if (!customName || typeof customName !== 'string' || customName.trim() === '') {
      return createErrorResponse('自定义名称不能为空', 400);
    }

    const share = await prisma.sharedVocabulary.findUnique({
      where: { code },
      include: {
        reviewGroup: {
          include: {
            words: {
              include: {
                word: true
              }
            }
          }
        }
      }
    });

    if (!share) {
      return NextResponse.json(
        { success: false, error: 'INVALID_CODE', message: '密钥不存在' },
        { status: 404 }
      );
    }

    if (!share.isActive) {
      return NextResponse.json(
        { success: false, error: 'INACTIVE_SHARE', message: '该分享已被撤销' },
        { status: 403 }
      );
    }

    if (share.expiresAt && share.expiresAt <= new Date()) {
      return NextResponse.json(
        { success: false, error: 'EXPIRED_CODE', message: '该密钥已过期' },
        { status: 410 }
      );
    }

    if (share.maxUses !== null && share.usedCount >= share.maxUses) {
      return NextResponse.json(
        { success: false, error: 'MAX_USES_REACHED', message: '使用次数已达上限' },
        { status: 429 }
      );
    }

    const existingImport = await prisma.sharedVocabularyImport.findUnique({
      where: {
        sharedId_importerId: {
          sharedId: share.id,
          importerId: userId
        }
      }
    });

    if (existingImport) {
      return NextResponse.json(
        { success: false, error: 'ALREADY_IMPORTED', message: '您已导入过该词库，无需重复导入' },
        { status: 409 }
      );
    }

    const words: WordData[] = share.reviewGroup.words.map((rgw) => ({
      word: rgw.word.word,
      phonetic: rgw.word.phonetic,
      pos: rgw.word.pos,
      translation: rgw.word.translation,
      example: rgw.word.example,
      exampleTranslation: rgw.word.exampleTranslation
    }));

    let targetGroupIdToUse: string = targetGroupId;
    let targetGroupName: string = customName.trim();

    if (targetGroupId) {
      const targetGroup = await prisma.reviewGroup.findUnique({
        where: { id: targetGroupId }
      });

      if (!targetGroup) {
        return createErrorResponse('目标分组不存在', 404);
      }

      if (targetGroup.userId !== userId) {
        return createErrorResponse('无权导入到他人的分组', 403);
      }

      targetGroupName = targetGroup.name;
    } else if (createNewGroup) {
      const newGroup = await prisma.reviewGroup.create({
        data: {
          name: customName.trim(),
          userId
        }
      });
      targetGroupIdToUse = newGroup.id;
    } else {
      return createErrorResponse('必须指定目标分组或设置 createNewGroup 为 true', 400);
    }

    let imported = 0;
    let skipped = 0;
    const batchSize = 100;

    try {
      await prisma.$executeRaw`PRAGMA synchronous = OFF`;
      await prisma.$executeRaw`PRAGMA journal_mode = MEMORY`;

      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < words.length; i += batchSize) {
          const batch = words.slice(i, i + batchSize);

          for (const wordData of batch) {
            const normalizedWord = wordData.word.toLowerCase().trim();

            if (skipExisting) {
              const existing = await tx.word.findUnique({
                where: {
                  word_userId: {
                    word: normalizedWord,
                    userId
                  }
                }
              });

              if (existing) {
                skipped++;
                continue;
              }
            }

            const word = await tx.word.create({
              data: {
                word: normalizedWord,
                phonetic: wordData.phonetic,
                pos: wordData.pos,
                translation: wordData.translation,
                example: wordData.example,
                exampleTranslation: wordData.exampleTranslation,
                userId
              }
            });

            await tx.reviewGroupWord.create({
              data: {
                reviewGroupId: targetGroupIdToUse,
                wordId: word.id
              }
            });

            imported++;
          }
        }

        await prisma.sharedVocabulary.update({
          where: { id: share.id },
          data: {
            usedCount: { increment: 1 },
            importedCount: { increment: 1 }
          }
        });

        await prisma.sharedVocabularyImport.create({
          data: {
            sharedId: share.id,
            importerId: userId,
            wordsImported: imported,
            wordsSkipped: skipped,
            targetGroupId: targetGroupIdToUse,
            skipExisting
          }
        });
      });

      await prisma.$executeRaw`PRAGMA synchronous = FULL`;
      await prisma.$executeRaw`PRAGMA journal_mode = DELETE`;

      return NextResponse.json({
        success: true,
        data: {
          wordsImported: imported,
          wordsSkipped: skipped,
          groupId: targetGroupIdToUse,
          groupName: targetGroupName,
          shareName: share.name
        }
      });
    } catch (transactionError: any) {
      await prisma.$executeRaw`PRAGMA synchronous = FULL`;
      await prisma.$executeRaw`PRAGMA journal_mode = DELETE`;
      throw transactionError;
    }
  } catch (error: any) {
    if (error.code === 'P2002') {
      return createErrorResponse('数据已存在', 409);
    }
    if (error.code === 'P2025') {
      return createErrorResponse('记录不存在', 404);
    }
    return handleApiError(error, 'share/import POST');
  }
}

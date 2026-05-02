import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

import { isValidShareCode } from '@/lib/share/codeGenerator';
import { sanitizeInput } from '@/lib/security';
import { logger } from '@/lib/logger';

// 辅助函数：将 Node.js Readable 流转换为标准 ReadableStream
function nodeReadableToWebStream(nodeReadable: Readable): ReadableStream {
  return Readable.toWeb(nodeReadable) as unknown as ReadableStream;
}

interface WordData {
  word: string;
  phonetic: string | null;
  pos: string | null;
  translation: string;
  example: string | null;
  exampleTranslation: string | null;
  publicWord?: {
    translation: string | null;
    phonetic: string | null;
    pos: string | null;
    example: string | null;
    exampleTranslation: string | null;
  } | null;
}

export async function POST(req: Request) {
  // 检查是否为测试环境
  const isTest = process.env.NODE_ENV === 'test';
  
  // 创建一个可读流来发送进度更新
  let stream: Readable;
  let push: (chunk: string | null) => boolean;
  let responses: string[] = [];
  
  stream = new Readable({
    read() {}
  });
  
  // 重写push方法，确保正确处理流
  const originalPush = stream.push.bind(stream);
  push = (chunk: string | null) => {
    if (chunk) {
      responses.push(chunk);
      return originalPush(chunk + '\n');
    }
    return originalPush(null);
  };

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      const errorResponse = { success: false, error: '未授权访问' };
      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { code: rawCode, customName: rawCustomName, targetGroupId, createNewGroup = true, skipExisting = true } = body;
    const code = typeof rawCode === 'string' ? rawCode.toUpperCase().trim() : rawCode;
    const sanitizedCustomName = rawCustomName ? sanitizeInput(String(rawCustomName).trim(), 100) : '';
    const customName = sanitizedCustomName || rawCustomName;

    if (!code || !isValidShareCode(code)) {
      const errorResponse = { success: false, error: 'INVALID_FORMAT', message: '密钥格式无效' };
      if (isTest) {
        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      push(JSON.stringify(errorResponse));
      push(null);
      return new Response(nodeReadableToWebStream(stream), { headers: { 'Content-Type': 'text/plain' } });
    }

    if (!targetGroupId && (!customName || typeof customName !== 'string' || customName.trim() === '')) {
      const errorResponse = { success: false, error: '自定义名称不能为空' };
      if (isTest) {
        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      push(JSON.stringify(errorResponse));
      push(null);
      return new Response(nodeReadableToWebStream(stream), { headers: { 'Content-Type': 'text/plain' } });
    }

    push(JSON.stringify({ progress: 0, step: '验证密钥' }));
    
    const share = await prisma.sharedVocabulary.findUnique({
      where: { code },
      include: {
        ReviewGroup: {
          include: {
            ReviewGroupWord: {
              include: {
                Word: {
                  include: {
                    publicWord: {
                      select: {
                        id: true,
                        phonetic: true,
                        pos: true,
                        translation: true,
                        example: true,
                        exampleTranslation: true,
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!share) {
      const errorResponse = { success: false, error: 'INVALID_CODE', message: '密钥不存在' };
      if (isTest) {
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      push(JSON.stringify(errorResponse));
      push(null);
      return new Response(nodeReadableToWebStream(stream), { headers: { 'Content-Type': 'text/plain' } });
    }

    if (!share.isActive) {
      const errorResponse = { success: false, error: 'INACTIVE_SHARE', message: '该分享已被撤销' };
      if (isTest) {
        return new Response(JSON.stringify(errorResponse), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      push(JSON.stringify(errorResponse));
      push(null);
      return new Response(nodeReadableToWebStream(stream), { headers: { 'Content-Type': 'text/plain' } });
    }

    if (share.expiresAt && share.expiresAt <= new Date()) {
      const errorResponse = { success: false, error: 'EXPIRED_CODE', message: '该密钥已过期' };
      if (isTest) {
        return new Response(JSON.stringify(errorResponse), {
          status: 410,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      push(JSON.stringify(errorResponse));
      push(null);
      return new Response(nodeReadableToWebStream(stream), { headers: { 'Content-Type': 'text/plain' } });
    }

    if (share.maxUses !== null && share.usedCount >= share.maxUses) {
      const errorResponse = { success: false, error: 'MAX_USES_REACHED', message: '使用次数已达上限' };
      if (isTest) {
        return new Response(JSON.stringify(errorResponse), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      push(JSON.stringify(errorResponse));
      push(null);
      return new Response(nodeReadableToWebStream(stream), { headers: { 'Content-Type': 'text/plain' } });
    }

    if (share.maxUses !== null) {
      const updated = await prisma.sharedVocabulary.updateMany({
        where: {
          id: share.id,
          usedCount: { lt: share.maxUses }
        },
        data: {
          usedCount: { increment: 1 }
        }
      });
      if (updated.count === 0) {
        const errorResponse = { success: false, error: 'MAX_USES_REACHED', message: '使用次数已达上限' };
        if (isTest) {
          return new Response(JSON.stringify(errorResponse), {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        push(JSON.stringify(errorResponse));
        push(null);
        return new Response(nodeReadableToWebStream(stream), { headers: { 'Content-Type': 'text/plain' } });
      }
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
      const targetGroup = await prisma.reviewGroup.findUnique({
        where: { id: existingImport.targetGroupId }
      });

      if (!targetGroup) {
        await prisma.sharedVocabularyImport.delete({
          where: { id: existingImport.id }
        });
      } else {
        const errorResponse = { success: false, error: 'ALREADY_IMPORTED', message: '您已导入过该词库，无需重复导入' };
        if (isTest) {
          return new Response(JSON.stringify(errorResponse), {
            status: 409,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        push(JSON.stringify(errorResponse));
        push(null);
        return new Response(nodeReadableToWebStream(stream), { headers: { 'Content-Type': 'text/plain' } });
      }
    }

    push(JSON.stringify({ progress: 10, step: '准备词库数据' }));
    
    const words: WordData[] = share.ReviewGroup.ReviewGroupWord.map((rgw) => ({
      word: rgw.Word.word,
      phonetic: rgw.Word.phonetic,
      pos: rgw.Word.pos,
      translation: rgw.Word.translation ?? '',
      example: rgw.Word.example,
      exampleTranslation: rgw.Word.exampleTranslation
    }));

    let targetGroupIdToUse: string = targetGroupId;
    let targetGroupName: string = customName?.trim() || '';

    if (targetGroupId) {
      push(JSON.stringify({ progress: 20, step: '验证目标分组' }));
      const targetGroup = await prisma.reviewGroup.findUnique({
        where: { id: targetGroupId }
      });

      if (!targetGroup) {
        const errorResponse = { success: false, error: '目标分组不存在' };
        if (isTest) {
          return new Response(JSON.stringify(errorResponse), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        push(JSON.stringify(errorResponse));
        push(null);
        return new Response(nodeReadableToWebStream(stream), { headers: { 'Content-Type': 'text/plain' } });
      }

      if (targetGroup.userId !== userId) {
        const errorResponse = { success: false, error: '无权导入到他人的分组' };
        if (isTest) {
          return new Response(JSON.stringify(errorResponse), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        push(JSON.stringify(errorResponse));
        push(null);
        return new Response(nodeReadableToWebStream(stream), { headers: { 'Content-Type': 'text/plain' } });
      }

      targetGroupName = targetGroup.name;
    } else if (createNewGroup) {
      push(JSON.stringify({ progress: 20, step: '创建新分组' }));
      const newGroup = await prisma.reviewGroup.create({
        data: {
          id: randomUUID(),
          name: customName.trim(),
          userId,
          updatedAt: new Date(),
        }
      });
      targetGroupIdToUse = newGroup.id;
    } else {
      const errorResponse = { success: false, error: '必须指定目标分组或设置 createNewGroup 为 true' };
      if (isTest) {
        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      push(JSON.stringify(errorResponse));
      push(null);
      return new Response(nodeReadableToWebStream(stream), { headers: { 'Content-Type': 'text/plain' } });
    }

    let imported = 0;
    let skipped = 0;
    const batchSize = 50;
    const maxTimeout = 30000;

    try {
      push(JSON.stringify({ progress: 30, step: '开始导入词汇' }));
      
      for (let i = 0; i < words.length; i += batchSize) {
        const batch = words.slice(i, i + batchSize);
        const progress = 30 + Math.round((i / words.length) * 60);
        
        push(JSON.stringify({ progress, step: `导入词汇 ${i + 1}-${Math.min(i + batchSize, words.length)}` }));

        await prisma.$transaction(async (tx) => {
          for (const wordData of batch) {
            try {
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
                  const existingLink = await tx.reviewGroupWord.findUnique({
                    where: {
                      reviewGroupId_wordId: {
                        reviewGroupId: targetGroupIdToUse,
                        wordId: existing.id
                      }
                    }
                  });

                  if (!existingLink) {
                    await tx.reviewGroupWord.create({
                      data: {
                        id: randomUUID(),
                        reviewGroupId: targetGroupIdToUse,
                        wordId: existing.id,
                      }
                    });
                  }
                  skipped++;
                  continue;
                }
              }

              const effectiveTranslation = wordData.translation ?? wordData.publicWord?.translation ?? '';
              const effectivePhonetic = wordData.phonetic ?? wordData.publicWord?.phonetic ?? null;
              const effectivePos = wordData.pos ?? wordData.publicWord?.pos ?? null;
              const effectiveExample = wordData.example ?? wordData.publicWord?.example ?? null;
              const effectiveExampleTranslation =
                wordData.exampleTranslation ?? wordData.publicWord?.exampleTranslation ?? null;

              // Ensure PublicWord exists so private Word can mirror it.
              let publicWordId: string | null = null;
              const existingPublic = await tx.publicWord.findUnique({
                where: { word: normalizedWord }
              });
              if (existingPublic) {
                publicWordId = existingPublic.id;
              } else if (effectiveTranslation && effectiveTranslation.trim() !== '') {
                try {
                  const createdPublic = await tx.publicWord.create({
                    data: {
                      id: randomUUID(),
                      word: normalizedWord,
                      translation: effectiveTranslation,
                      phonetic: effectivePhonetic,
                      pos: effectivePos,
                      example: effectiveExample,
                      exampleTranslation: effectiveExampleTranslation,
                      updatedAt: new Date(),
                    }
                  });
                  publicWordId = createdPublic.id;
                } catch (e: unknown) {
                  const ec = (e as { code?: string }).code;
                  if (ec === 'P2002') {
                    const pw = await tx.publicWord.findUnique({ where: { word: normalizedWord } });
                    publicWordId = pw?.id || null;
                  } else {
                    throw e;
                  }
                }
              }

              const word = await tx.word.create({
                data: {
                  id: randomUUID(),
                  word: normalizedWord,
                  userId,
                  sourceType: 'PUBLIC',
                  publicWordId,
                  translation: null,
                  phonetic: null,
                  pos: null,
                  example: null,
                  exampleTranslation: null,
                  updatedAt: new Date(),
                }
              });

              await tx.reviewGroupWord.create({
                data: {
                  id: randomUUID(),
                  reviewGroupId: targetGroupIdToUse,
                  wordId: word.id,
                }
              });

              imported++;
            } catch (wordError: unknown) {
              const wec = (wordError as { code?: string }).code;
              if (wec === 'P2002') {
                skipped++;
                continue;
              }
              throw wordError;
            }
          }
        }, { timeout: maxTimeout });
      }

      push(JSON.stringify({ progress: 90, step: '更新导入记录' }));
      
      await prisma.sharedVocabulary.update({
        where: { id: share.id },
        data: {
          importedCount: { increment: imported },
          ...(share.maxUses === null ? { usedCount: { increment: 1 } } : {})
        }
      });

      await prisma.sharedVocabularyImport.create({
        data: {
          id: randomUUID(),
          sharedId: share.id,
          importerId: userId,
          wordsImported: imported,
          wordsSkipped: skipped,
          targetGroupId: targetGroupIdToUse,
          skipExisting
        }
      });

      // 获取新导入的单词数据
      const newWords = await prisma.word.findMany({
        where: {
          userId,
          ReviewGroupWord: {
            some: {
              reviewGroupId: targetGroupIdToUse
            }
          }
        },
        include: {
          publicWord: {
            select: {
              phonetic: true,
              pos: true,
              translation: true,
              example: true,
              exampleTranslation: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: imported
      });

      const successResponse = {
        success: true,
        data: {
          wordsImported: imported,
          wordsSkipped: skipped,
          groupId: targetGroupIdToUse,
          groupName: targetGroupName,
          shareName: share.name,
          newWords: newWords.map((w) => ({
            id: w.id,
            word: w.word,
            phonetic: w.phonetic ?? w.publicWord?.phonetic ?? null,
            pos: w.pos ?? w.publicWord?.pos ?? null,
            translation: w.translation ?? w.publicWord?.translation ?? '',
            example: w.example ?? w.publicWord?.example ?? null,
            exampleTranslation: w.exampleTranslation ?? w.publicWord?.exampleTranslation ?? null,
            correctCount: w.correctCount,
            incorrectCount: w.incorrectCount,
            updatedAt: w.updatedAt
          }))
        }
      };
      
      push(JSON.stringify({ progress: 100, step: '导入完成' }));
      push(JSON.stringify(successResponse));
      push(null);
      
      if (isTest) {
        return new Response(JSON.stringify(successResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(nodeReadableToWebStream(stream), { headers: { 'Content-Type': 'text/plain' } });
    } catch (err: unknown) {
      const tranCode = (err as { code?: string }).code;
      const tranMsg = err instanceof Error ? err.message : String(err);
      // 记录详细错误信息
      logger.error({ err }, 'Transaction error');
      
      // 处理测试环境中的错误
      if (isTest) {
        if (tranCode === 'P2002') {
          const errorResponse = {
            success: false, 
            error: '数据已存在',
            message: '数据已存在：该词汇库已被导入过',
            suggestion: '每个用户只能导入同一个分享密钥一次。如需重新导入，请先删除已导入的词库',
            step: '导入验证阶段'
          };
          return new Response(JSON.stringify(errorResponse), {
            status: 409,
            headers: { 'Content-Type': 'application/json' }
          });
        } else if (tranCode === 'P2025') {
          const errorResponse = {
            success: false, 
            error: '记录不存在',
            message: '记录不存在：分享密钥对应的词库未找到',
            suggestion: '请检查密钥是否正确，或确认该分享密钥是否仍然有效',
            step: '密钥验证阶段'
          };
          return new Response(JSON.stringify(errorResponse), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      // 根据错误类型返回具体的错误信息
      let errorMessage = '导入过程中发生错误';
      let errorCode = 'IMPORT_FAILED';
      let suggestion = '请检查网络连接后重试';
      
      if (tranCode === 'SQLITE_CONSTRAINT') {
        errorMessage = '数据约束冲突：部分词汇已存在于您的词库中';
        errorCode = 'DATA_CONSTRAINT';
        suggestion = '系统已自动跳过重复词汇，如仍有问题请清空目标分组后重试';
      } else if (tranCode === 'SQLITE_FULL') {
        errorMessage = '存储空间不足：无法写入更多词汇数据';
        errorCode = 'STORAGE_FULL';
        suggestion = '请清理部分不需要的词汇或联系管理员增加存储配额';
      } else if (tranMsg.includes('timeout')) {
        errorMessage = '数据库操作超时：词汇量较大，处理时间超过限制';
        errorCode = 'TIMEOUT';
        suggestion = '系统已自动采用分批处理策略（每批 50 个词汇），如仍超时建议：1) 联系分享者拆分词库 2) 选择词汇数较少的词库 3) 稍后重试';
      } else if (tranMsg.includes('connection')) {
        errorMessage = '数据库连接失败：无法访问词汇数据';
        errorCode = 'CONNECTION_ERROR';
        suggestion = '请检查数据库连接状态或刷新页面后重试';
      }
      
      const errorResponse = {
        success: false, 
        error: errorCode, 
        message: errorMessage,
        details: tranMsg,
        suggestion: suggestion,
        step: '词汇导入阶段'
      };
      
      push(JSON.stringify(errorResponse));
      push(null);
      
      if (isTest) {
        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(nodeReadableToWebStream(stream), { headers: { 'Content-Type': 'text/plain' } });
    }
  } catch (err: unknown) {
    const outerCode = (err as { code?: string }).code;
    const outerMeta = (err as { meta?: { field_name?: string } }).meta;
    // 根据错误类型返回具体的错误信息
    if (outerCode === 'P2002') {
      const errorResponse = {
        success: false, 
        error: 'DUPLICATE_DATA',
        message: '数据已存在：该词汇库已被导入过',
        suggestion: '每个用户只能导入同一个分享密钥一次。如需重新导入，请先删除已导入的词库',
        step: '导入验证阶段'
      };
      
      push(JSON.stringify(errorResponse));
      push(null);
      
      if (isTest) {
        return new Response(JSON.stringify(errorResponse), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(nodeReadableToWebStream(stream), { headers: { 'Content-Type': 'text/plain' } });
    }
    if (outerCode === 'P2025') {
      const errorResponse = {
        success: false, 
        error: 'NOT_FOUND',
        message: '记录不存在：分享密钥对应的词库未找到',
        suggestion: '请检查密钥是否正确，或确认该分享密钥是否仍然有效',
        step: '密钥验证阶段'
      };
      
      push(JSON.stringify(errorResponse));
      push(null);
      
      if (isTest) {
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(nodeReadableToWebStream(stream), { headers: { 'Content-Type': 'text/plain' } });
    }
    if (outerCode === 'P2003') {
      logger.error({ err, fieldName: outerMeta?.field_name }, '[ShareImport] P2003 FK constraint');
      const errorResponse = {
        success: false, 
        error: 'FOREIGN_KEY_ERROR',
        message: '分组关联失败：目标分组不存在或已被删除',
        suggestion: '请尝试创建新分组或选择其他现有分组',
        step: '分组创建阶段',
        detail: 'FK: ' + (outerMeta?.field_name || 'unknown')
      };
      
      push(JSON.stringify(errorResponse));
      push(null);
      
      if (isTest) {
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(nodeReadableToWebStream(stream), { headers: { 'Content-Type': 'text/plain' } });
    }
    
    // 通用错误处理
    const errorResponse = { success: false, error: '服务器错误', message: '导入过程中发生未知错误' };
    push(JSON.stringify(errorResponse));
    push(null);
    
    if (isTest) {
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(nodeReadableToWebStream(stream), { headers: { 'Content-Type': 'text/plain' } });
  }
}

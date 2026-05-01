import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { validateInput, sanitizeWordList } from '@/lib/security';
import { rateLimit, getClientKey } from '@/lib/rateLimit';
import { detectBatchPromptInjection } from '@/lib/injectionDetector';
import { checkUserBan, checkIpBan } from '@/lib/banManager';
import { API_QUOTA_EXHAUSTED_MESSAGE } from '@/lib/llmPool';
import { TranslationService } from '@/services/TranslationService';
import { CacheService } from '@/services/CacheService';
import { StreamHandler } from '@/services/StreamHandler';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const RECORD_TRANSLATIONS = true;

async function safeRecordTranslation(
  userId: string,
  wordData: any,
  isCached: boolean,
  clientIp: string | null,
  userAgent: string | null
): Promise<void> {
  try {
    const word = wordData.word?.toLowerCase()?.trim() || '';
    const requestHash = `${userId}:${word}:${Math.floor(Date.now() / 60000)}`; // 1分钟窗口
    
    const existing = await prisma.translationRecord.findFirst({
      where: { requestHash }
    });
    
    if (existing) {
      logger.debug(`[TranslationRecord] Duplicate skipped: ${word} for user ${userId}`);
      return;
    }
    
    await prisma.translationRecord.create({
      data: {
        id: randomUUID(),
        userId,
        word,
        phonetic: wordData.phonetic || null,
        pos: wordData.pos || null,
        translation: wordData.translation || '',
        example: wordData.example || null,
        exampleTranslation: wordData.exampleTranslation || null,
        isCached,
        ipAddress: clientIp,
        userAgent,
        requestHash
      }
    });
    logger.debug(`[TranslationRecord] Recorded: ${word} for user ${userId} (cached=${isCached})`);
  } catch (e) {
    logger.error('Failed to record translation:', e);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                       req.headers.get('x-real-ip') ||
                       'unknown';
    
    const userBanStatus = await checkUserBan(session.user.id);
    if (userBanStatus.isBanned) {
      return NextResponse.json(
        { error: userBanStatus.reason || 'Account banned' },
        { status: 403 }
      );
    }

    const ipBanStatus = await checkIpBan(clientIp);
    if (ipBanStatus.isBanned) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const rateLimitKey = getClientKey(req, session.user.id);
    const rateLimitResult = await rateLimit(rateLimitKey);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const body = await req.json();
    const { words, options, targetGroupId } = body;

    if (!words || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: 'Words list is required' }, { status: 400 });
    }

    const sanitizedWords = sanitizeWordList(words);
    const normalizedWords = sanitizedWords.map((w: string) => w.toLowerCase().trim()).filter(Boolean);

    if (normalizedWords.length === 0) {
      return NextResponse.json({ error: 'Invalid words list' }, { status: 400 });
    }

    for (const word of normalizedWords) {
      const validation = validateInput(word);
      if (!validation.valid) {
        logger.warn(`Blocked potentially malicious input: ${validation.reason}`);
        return NextResponse.json({ error: 'Invalid input detected' }, { status: 400 });
      }
    }

    detectBatchPromptInjection(normalizedWords);

    if (targetGroupId) {
      const targetGroup = await prisma.reviewGroup.findUnique({
        where: { id: targetGroupId }
      });
      if (!targetGroup || targetGroup.userId !== session.user.id) {
        return NextResponse.json({ error: 'Invalid target group' }, { status: 400 });
      }
    }

    // Initialize services
    const cacheService = new CacheService(session, words);
    const translationService = new TranslationService(session, words);
    const streamHandler = new StreamHandler(translationService);

    // Get cached words from user database
    const { cachedWords, cachedWordStrings } = await cacheService.getCachedWords(normalizedWords);

    // Update incomplete cached words with better data from public library
    const updatedCachedWords = await cacheService.updateIncompleteCachedWords(cachedWords);

    // Get words missing from user library
    const missingFromUserWords = normalizedWords.filter((w: string) => !cachedWordStrings.includes(w));

    // Get public cached words
    const { publicCachedWords, publicCachedWordStrings } = await cacheService.getPublicCachedWords(missingFromUserWords);

    // Copy public words to user database
    await cacheService.copyPublicWordsToUserDb(publicCachedWords, targetGroupId);

    // Filter words that need to be fetched from LLM
    const wordsToFetch = missingFromUserWords.filter((w: string) => !publicCachedWordStrings.includes(w));

    // Get words needing refresh from public cache
    const publicWordService = new (await import('@/services/PublicWordService')).default(session.user.id);
    const wordsNeedingRefresh = await publicWordService.getWordsNeedingRefresh(publicCachedWords);
    
    // Add refresh words to fetch list if not already included
    for (const w of wordsNeedingRefresh) {
      if (!wordsToFetch.includes(w)) {
        wordsToFetch.push(w);
      }
    }

    // Detect special cases (non-English, sentences)
    const { filteredWords, specialResults } = await translationService.detectSpecialCases(wordsToFetch);

    // Format cached results
    const formattedCachedResults = cacheService.formatCachedResults(updatedCachedWords, publicCachedWords, specialResults);

    // Auto-sync with public library updates
    const syncedResults = await cacheService.autoSync(cachedWordStrings, formattedCachedResults);

    // Update cache timestamps
    await cacheService.updateCacheTimestamps(cachedWordStrings, targetGroupId);

    // Order results by original input
    const orderedCachedResults = cacheService.orderResultsByInput(words, syncedResults);

    // Handle case where all words are cached
    if (filteredWords.length === 0) {
      if (RECORD_TRANSLATIONS && orderedCachedResults.length > 0) {
        try {
          const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                           req.headers.get('x-real-ip') ||
                           null;
          const userAgent = req.headers.get('user-agent') || null;
          
          logger.debug(`[TranslationRecord] Recording ${orderedCachedResults.length} cached translations for user: ${session.user.id}`);
          
          for (const item of orderedCachedResults) {
            await safeRecordTranslation(session.user.id, item, true, clientIp, userAgent);
          }
        } catch (recordErr) {
          logger.error('Cached translation recording error:', recordErr);
        }
      }
      
      const cacheStream = streamHandler.createCacheStream(orderedCachedResults);
      return streamHandler.createStreamResponse(cacheStream);
    }

    // Get provider candidates
    const providerCandidates = await translationService.getProviderCandidates();
    if (providerCandidates.length === 0) {
      return NextResponse.json({ error: API_QUOTA_EXHAUSTED_MESSAGE }, { status: 503 });
    }

    // Process translation
    const translationResult = await translationService.translate(filteredWords, options, targetGroupId, providerCandidates);

    // Handle case where all words were found in concurrent requests
    if ('response' in translationResult) {
      const { response } = translationResult;
      const translationStream = streamHandler.createTranslationStream(response, orderedCachedResults, targetGroupId);
      return streamHandler.createStreamResponse(translationStream);
    } else {
      // All words were found in cache or concurrent requests
      const cacheStream = streamHandler.createCacheStream([...orderedCachedResults, ...translationResult]);
      return streamHandler.createStreamResponse(cacheStream);
    }

  } catch (error: any) {
    logger.error({ err: error, message: error?.message, stack: error?.stack }, 'API Error');
    
    if (String(error?.message || '') === API_QUOTA_EXHAUSTED_MESSAGE) {
      return NextResponse.json({ 
        error: API_QUOTA_EXHAUSTED_MESSAGE 
      }, { status: 503 });
    }
    
    if (error?.code === 'SELF_SIGNED_CERT_IN_CHAIN' || 
        error?.message?.includes('certificate')) {
      return NextResponse.json({ 
        error: 'SSL 证书验证失败，请联系管理员检查证书配置',
        details: error?.message
      }, { status: 503 });
    }
    
    if (/connection|timeout|network|ECONNREFUSED|ENOTFOUND/i.test(error?.message || '')) {
      return NextResponse.json({ 
        error: '无法连接到翻译服务，请检查网络连接',
        details: error?.message
      }, { status: 503 });
    }
    
    if (error?.message?.includes('SetLimitExceeded') || 
        error?.message?.includes('inference limit')) {
      return NextResponse.json({ 
        error: '模型配额已用尽，请联系管理员调整配额或切换模型',
        details: error?.message
      }, { status: 503 });
    }
    
    return NextResponse.json({ 
      error: 'Translation failed',
      details: error?.message
    }, { status: 500 });
  }
}


import { CachedWord } from './CacheService'
import { TranslationService } from './TranslationService'

export class StreamHandler {
  private readonly translationService: TranslationService

  constructor(translationService: TranslationService) {
    this.translationService = translationService
  }

  createCacheStream(orderedCachedResults: CachedWord[]): ReadableStream {
    const cacheJsonStr = JSON.stringify({ results: orderedCachedResults })
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(cacheJsonStr + '\n\n'))
        controller.close()
      },
    })
    return stream
  }

  createCompletedTranslationStream(
    results: CachedWord[],
    targetGroupId?: string,
    upstreamAbortController?: AbortController,
  ): ReadableStream {
    const translationService = this.translationService
    const signal = upstreamAbortController?.signal
    const encoder = new TextEncoder()
    return new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'translation-final', results }) + '\n\n'))
        try {
          const words = await translationService.saveWordsToDatabase(results, targetGroupId, signal)
          if (!signal?.aborted) {
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'translation-save', words, targetGroupId: targetGroupId || null,
            }) + '\n\n'))
          }
        } catch {
          if (!signal?.aborted) {
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'translation-save',
              words: results.map((result) => ({ word: result.word, status: 'error' })),
              targetGroupId: targetGroupId || null,
            }) + '\n\n'))
          }
        } finally {
          if (!signal?.aborted) controller.close()
        }
      },
      cancel() { upstreamAbortController?.abort() },
    })
  }

  createTranslationStream(
    response: AsyncIterable<{ choices?: Array<{ delta?: { content?: string | null } }> }>,
    orderedCachedResults: CachedWord[],
    targetGroupId?: string,
    upstreamAbortController?: AbortController,
  ): ReadableStream {
    const translationService = this.translationService
    const stream = new ReadableStream({
      async start(controller) {
        await translationService.processTranslationStream(
          response,
          controller,
          orderedCachedResults,
          targetGroupId,
          upstreamAbortController?.signal,
        )
      },
      cancel() {
        // 客户端断开：真正中断上游 LLM stream，停止后续 token 生成
        upstreamAbortController?.abort()
      },
    })
    return stream
  }

  createStreamResponse(stream: ReadableStream, deliveryEvents = false): Response {
    return new Response(stream, {
      headers: {
        'Content-Type': deliveryEvents ? 'application/x-ndjson' : 'text/event-stream',
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }
}

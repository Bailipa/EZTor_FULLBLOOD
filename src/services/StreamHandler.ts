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
        )
      },
      cancel() {
        // 客户端断开：真正中断上游 LLM stream，停止后续 token 生成
        upstreamAbortController?.abort()
      },
    })
    return stream
  }

  createStreamResponse(stream: ReadableStream): Response {
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }
}

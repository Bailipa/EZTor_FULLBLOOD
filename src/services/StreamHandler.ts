import { CachedWord } from './CacheService';
import { TranslationService } from './TranslationService';

export class StreamHandler {
  private readonly translationService: TranslationService;

  constructor(translationService: TranslationService) {
    this.translationService = translationService;
  }

  createCacheStream(orderedCachedResults: CachedWord[]): ReadableStream {
    const cacheJsonStr = JSON.stringify({ results: orderedCachedResults });
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(cacheJsonStr + '\n\n'));
        controller.close();
      }
    });
    return stream;
  }

  createTranslationStream(response: any, orderedCachedResults: CachedWord[], targetGroupId?: string): ReadableStream {
    const stream = new ReadableStream({
      async start(controller) {
        await this.translationService.processTranslationStream(response, controller, orderedCachedResults, targetGroupId);
      }
    });
    return stream;
  }

  createStreamResponse(stream: ReadableStream): Response {
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }
}

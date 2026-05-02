import { EdgeSpeechTTS } from '@lobehub/tts';
import WebSocket from 'ws';

export type TtsResponseFormat = 'mp3';

export type TtsRequest = {
  input: string;
  voice?: string;
  speed?: number; // 0.5 ~ 2.0
  response_format?: TtsResponseFormat;
  signal?: AbortSignal;
};

const MAX_INPUT_LENGTH = 500;
const TTS_TIMEOUT_MS = 30000;

const DEFAULT_VOICE = 'en-US-GuyNeural';

function clampSpeed(speed: number | undefined): number {
  if (!Number.isFinite(speed)) return 1;
  return Math.min(2, Math.max(0.5, speed!));
}

function normalizeVoice(voice: string | undefined): string {
  const v = (voice || '').trim();
  return v || DEFAULT_VOICE;
}

let ttsSingleton: EdgeSpeechTTS | null = null;

function getEdgeTts(): EdgeSpeechTTS {
  // Node.js doesn't provide a WebSocket global; EdgeSpeechTTS needs it.
  if (!(globalThis as Record<string, unknown>).WebSocket) {
    (globalThis as Record<string, unknown>).WebSocket = WebSocket;
  }
  if (!ttsSingleton) ttsSingleton = new EdgeSpeechTTS();
  return ttsSingleton;
}

/**
 * Generate speech audio using Microsoft Edge TTS.
 * This is an in-process alternative to the python-based OpenAI-compatible server:
 * https://github.com/Ikaros-521/edgeTTS-openai-api
 */
export async function synthesizeSpeech(req: TtsRequest): Promise<Response> {
  const input = (req.input || '').trim();
  if (!input) throw new Error('input is required');
  if (input.length > MAX_INPUT_LENGTH) throw new Error(`Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`);

  const voice = normalizeVoice(req.voice);
  const speed = clampSpeed(req.speed);

  const abortController = new AbortController();
  const timeoutId = setTimeout(
    () => abortController.abort(new DOMException('TTS request timed out', 'TimeoutError')),
    TTS_TIMEOUT_MS,
  );

  const signal = req.signal;
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      abortController.abort(signal.reason);
    } else {
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        abortController.abort(signal.reason);
      }, { once: true });
    }
  }

  // EdgeSpeechTTS currently produces mp3 (audio-24khz-48kbitrate-mono-mp3).
  const tts = getEdgeTts() as unknown as { create: (args: Record<string, unknown>) => Promise<Response> };
  const response = await tts.create({
    input,
    options: { voice, rate: speed },
    signal: abortController.signal,
  });

  clearTimeout(timeoutId);
  return response;
}

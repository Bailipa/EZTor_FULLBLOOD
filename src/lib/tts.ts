import { EdgeSpeechTTS } from '@lobehub/tts';
import WebSocket from 'ws';

export type TtsResponseFormat = 'mp3';

export type TtsRequest = {
  input: string;
  voice?: string;
  speed?: number; // 0.5 ~ 2.0
  response_format?: TtsResponseFormat;
};

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
  if (!(globalThis as any).WebSocket) {
    (globalThis as any).WebSocket = WebSocket as any;
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

  const voice = normalizeVoice(req.voice);
  const speed = clampSpeed(req.speed);

  // EdgeSpeechTTS currently produces mp3 (audio-24khz-48kbitrate-mono-mp3).
  const response = await getEdgeTts().create({
    input,
    // `@lobehub/tts` types currently only expose `voice`, but the underlying SSML
    // generator supports `rate`/`pitch`. We pass `rate` at runtime intentionally.
    options: { voice, rate: speed } as any,
  });

  return response;
}

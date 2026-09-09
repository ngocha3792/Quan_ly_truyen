import { Injectable } from '@nestjs/common';

import type {
  TtsGenerateRequest,
  TtsGenerateResult,
  TtsProviderPort,
  TtsWordTiming,
} from '../../application';
import { TtsProviderException } from '../../domain';

const BASE_URL = 'https://api.elevenlabs.io/v1';
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MICRO_DOLLARS_PER_CHARACTER = 300n;

interface ElevenLabsResponse {
  audio_base64?: unknown;
  alignment?: unknown;
  normalized_alignment?: unknown;
}

@Injectable()
export class ElevenLabsTtsAdapter implements TtsProviderPort {
  readonly provider = 'ELEVEN_LABS' as const;
  readonly maxCharactersPerRequest = 5_000;

  async generate(input: TtsGenerateRequest): Promise<TtsGenerateResult> {
    let response: Response;
    try {
      response = await fetch(
        `${BASE_URL}/text-to-speech/${encodeURIComponent(input.voiceId)}/with-timestamps?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'xi-api-key': input.apiKey,
          },
          body: JSON.stringify({
            text: input.text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: compactVoiceSettings(input),
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
    } catch (error) {
      throw new TtsProviderException(
        error instanceof Error ? error.message : 'Không thể kết nối ElevenLabs',
      );
    }
    if (!response.ok) {
      throw new TtsProviderException(
        `ElevenLabs trả HTTP ${response.status}`,
        response.status >= 500 || response.status === 429,
      );
    }
    const body = (await response.json()) as ElevenLabsResponse;
    if (typeof body.audio_base64 !== 'string') {
      throw new TtsProviderException(
        'ElevenLabs trả payload audio không hợp lệ',
        false,
      );
    }
    const audioBuffer = Buffer.from(body.audio_base64, 'base64');
    if (!audioBuffer.length || audioBuffer.length > MAX_AUDIO_BYTES) {
      throw new TtsProviderException(
        'Kích thước audio ElevenLabs không hợp lệ',
        false,
      );
    }
    const wordTimings = parseWordTimings(
      body.normalized_alignment ?? body.alignment,
    );
    const durationMs =
      wordTimings?.at(-1)?.endMs ?? estimateDurationMs(input.text);
    return { audioBuffer, durationMs, format: 'mp3', wordTimings };
  }

  estimateCostMicros(characterCount: number): bigint {
    return BigInt(characterCount) * MICRO_DOLLARS_PER_CHARACTER;
  }

  async validateVoice(apiKey: string, voiceId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${BASE_URL}/voices/${encodeURIComponent(voiceId)}`,
        {
          headers: { 'xi-api-key': apiKey },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      if (response.status === 404) return false;
      if (!response.ok)
        throw new TtsProviderException(
          `ElevenLabs trả HTTP ${response.status}`,
          response.status >= 500 || response.status === 429,
        );
      return true;
    } catch (error) {
      if (error instanceof TtsProviderException) throw error;
      throw new TtsProviderException(
        error instanceof Error
          ? error.message
          : 'Không thể xác minh voice ElevenLabs',
      );
    }
  }
}

function compactVoiceSettings(
  input: TtsGenerateRequest,
): Record<string, number> | undefined {
  const settings = Object.fromEntries(
    [
      ['stability', input.stability],
      ['similarity_boost', input.similarity],
      ['style', input.style],
    ].filter((entry): entry is [string, number] => entry[1] !== null),
  );
  return Object.keys(settings).length ? settings : undefined;
}

function parseWordTimings(value: unknown): readonly TtsWordTiming[] | null {
  if (!isRecord(value)) return null;
  const characters = value['characters'];
  const starts = value['character_start_times_seconds'];
  const ends = value['character_end_times_seconds'];
  if (
    !isStringArray(characters) ||
    !isNumberArray(starts) ||
    !isNumberArray(ends) ||
    characters.length !== starts.length ||
    starts.length !== ends.length
  )
    return null;
  const words: TtsWordTiming[] = [];
  let text = '';
  let startMs = 0;
  let endMs = 0;
  for (let index = 0; index <= characters.length; index += 1) {
    const character = characters[index];
    const boundary =
      index === characters.length ||
      typeof character !== 'string' ||
      /\s/u.test(character);
    if (boundary) {
      if (text) words.push({ word: text, startMs, endMs });
      text = '';
      continue;
    }
    const start = starts[index];
    const end = ends[index];
    if (typeof start !== 'number' || typeof end !== 'number') return null;
    if (!text) startMs = Math.max(0, Math.round(start * 1000));
    text += character;
    endMs = Math.max(startMs, Math.round(end * 1000));
  }
  return words.length ? words : null;
}

function estimateDurationMs(text: string): number {
  return Math.max(
    1_000,
    Math.round((text.trim().split(/\s+/u).length / 150) * 60_000),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'number')
  );
}

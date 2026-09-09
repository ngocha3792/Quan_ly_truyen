export const TTS_PROVIDER_PORT = Symbol.for(
  'quan-ly-truyen.modules.tts.provider',
);

export interface TtsWordTiming {
  readonly word: string;
  readonly startMs: number;
  readonly endMs: number;
}

export interface TtsGenerateRequest {
  readonly apiKey: string;
  readonly text: string;
  readonly voiceId: string;
  readonly language: string;
  readonly stability: number | null;
  readonly similarity: number | null;
  readonly style: number | null;
}

export interface TtsGenerateResult {
  readonly audioBuffer: Buffer;
  readonly durationMs: number;
  readonly format: 'mp3';
  readonly wordTimings: readonly TtsWordTiming[] | null;
}

export interface TtsProviderPort {
  readonly provider: 'ELEVEN_LABS';
  readonly maxCharactersPerRequest: number;
  generate(input: TtsGenerateRequest): Promise<TtsGenerateResult>;
  estimateCostMicros(characterCount: number): bigint;
  validateVoice(apiKey: string, voiceId: string): Promise<boolean>;
}

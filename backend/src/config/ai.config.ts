import { registerAs } from '@nestjs/config';

import type { AiConfig } from './config.types';

export const AI_CONFIG_KEY = 'ai';

function optionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized || undefined;
}

export default registerAs(AI_CONFIG_KEY, (): AiConfig => ({
  encryptionKeyBase64: optionalString(process.env.AI_API_KEY_ENCRYPTION_KEY),
  gemini: {
    model: process.env.AI_GEMINI_MODEL ?? 'gemini-2.5-flash',
  },
  openai: {
    model: process.env.AI_OPENAI_MODEL ?? 'gpt-4o-mini',
  },
  anthropic: {
    model: process.env.AI_ANTHROPIC_MODEL ?? 'claude-3-5-haiku-latest',
  },
}));

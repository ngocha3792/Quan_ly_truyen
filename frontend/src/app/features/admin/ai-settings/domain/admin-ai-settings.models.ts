export type AiProviderId = 'GEMINI' | 'OPENAI' | 'ANTHROPIC';

export interface AiProviderKeyStatus {
  readonly provider: AiProviderId;
  readonly configured: boolean;
  readonly lastFour: string | null;
  readonly updatedAt: string | null;
}

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  GEMINI: 'Gemini',
  OPENAI: 'ChatGPT (OpenAI)',
  ANTHROPIC: 'Claude (Anthropic)',
};

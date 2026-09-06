export type AiProviderId = 'GEMINI' | 'OPENAI' | 'ANTHROPIC' | 'OPENAI_COMPATIBLE';

export const AI_PROVIDERS: readonly AiProviderId[] = [
  'GEMINI',
  'OPENAI',
  'ANTHROPIC',
  'OPENAI_COMPATIBLE',
];

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  GEMINI: 'Gemini',
  OPENAI: 'ChatGPT (OpenAI)',
  ANTHROPIC: 'Claude (Anthropic)',
  OPENAI_COMPATIBLE: 'OpenAI Compatible',
};

export interface AiConnection {
  readonly id: string;
  readonly name: string;
  readonly provider: AiProviderId;
  readonly baseUrl: string | null;
  readonly defaultModel: string | null;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateAiConnectionPayload {
  readonly name: string;
  readonly provider: AiProviderId;
  readonly apiKey: string;
  readonly baseUrl?: string | null;
  readonly defaultModel?: string | null;
}

export interface UpdateAiConnectionPayload {
  readonly name?: string;
  readonly apiKey?: string;
  readonly baseUrl?: string | null;
  readonly defaultModel?: string | null;
  readonly enabled?: boolean;
}

export interface AiConnectionTestResult {
  readonly ok: boolean;
  readonly message?: string;
}

export type AiProviderId =
  'GEMINI' | 'OPENAI' | 'ANTHROPIC' | 'OPENAI_COMPATIBLE' | 'ANTHROPIC_COMPATIBLE';

export type AiProtocol =
  'OPENAI_RESPONSES' | 'OPENAI_CHAT_COMPLETIONS' | 'ANTHROPIC_MESSAGES' | 'GEMINI_GENERATE_CONTENT';

export type AiAuthType = 'BEARER' | 'X_API_KEY' | 'API_KEY_HEADER' | 'QUERY_PARAM';

export const AI_PROVIDERS: readonly AiProviderId[] = [
  'GEMINI',
  'OPENAI',
  'ANTHROPIC',
  'OPENAI_COMPATIBLE',
  'ANTHROPIC_COMPATIBLE',
];

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  GEMINI: 'Gemini',
  OPENAI: 'ChatGPT (OpenAI)',
  ANTHROPIC: 'Claude (Anthropic)',
  OPENAI_COMPATIBLE: 'OpenAI Compatible',
  ANTHROPIC_COMPATIBLE: 'Anthropic Compatible',
};

export const AI_AUTH_TYPES: readonly AiAuthType[] = [
  'BEARER',
  'X_API_KEY',
  'API_KEY_HEADER',
  'QUERY_PARAM',
];

export const AI_AUTH_TYPE_LABELS: Record<AiAuthType, string> = {
  BEARER: 'Bearer token',
  X_API_KEY: 'x-api-key',
  API_KEY_HEADER: 'Header tùy chỉnh',
  QUERY_PARAM: 'Query parameter',
};

export interface AiConnection {
  readonly id: string;
  readonly name: string;
  readonly provider: AiProviderId;
  readonly vendorHint: string | null;
  readonly protocol: AiProtocol;
  readonly authType: AiAuthType;
  readonly authHeaderName: string | null;
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
  readonly authType?: AiAuthType;
  readonly authHeaderName?: string | null;
}

export interface UpdateAiConnectionPayload {
  readonly name?: string;
  readonly apiKey?: string;
  readonly baseUrl?: string | null;
  readonly defaultModel?: string | null;
  readonly enabled?: boolean;
  readonly authType?: AiAuthType;
  readonly authHeaderName?: string | null;
}

export interface AiConnectionTestResult {
  readonly ok: boolean;
  readonly message?: string;
}

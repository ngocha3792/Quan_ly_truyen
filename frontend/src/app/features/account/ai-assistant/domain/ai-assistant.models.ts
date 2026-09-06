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
  OPENAI: 'ChatGPT',
  ANTHROPIC: 'Claude',
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

export type AiFallbackPolicy = 'NONE' | 'SYSTEM';
export type AiRateLimitTier = 'FREE' | 'PRO' | 'ENTERPRISE';

export interface AiPolicy {
  readonly userId: string;
  readonly rateLimitTier: AiRateLimitTier;
  readonly fallbackPolicy: AiFallbackPolicy;
  readonly limits: {
    readonly windowSeconds: number;
    readonly requests: number;
    readonly tokens: number;
  };
  readonly updatedAt: string | null;
}

export interface AiProfile {
  readonly scope: 'USER' | 'STORY';
  readonly userId: string;
  readonly storyId: string | null;
  readonly model: string | null;
  readonly systemPrompt: string | null;
  readonly defaultTranslationLanguageCode: string;
  readonly autoTranslateOnPublish: boolean;
  readonly inherits: readonly string[];
  readonly updatedAt: string | null;
}

export interface UpdateAiProfilePayload {
  readonly model?: string | null;
  readonly systemPrompt?: string | null;
  readonly defaultTranslationLanguageCode?: string;
  readonly autoTranslateOnPublish?: boolean;
}

export interface AiConversationSummary {
  readonly id: string;
  readonly connectionId: string | null;
  readonly provider: AiProviderId;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type AiMessageRole = 'USER' | 'ASSISTANT';

export interface AiMessage {
  readonly id: string;
  readonly role: AiMessageRole;
  readonly content: string;
  readonly createdAt: string;
  readonly pending?: boolean;
}

export interface AiConversationDetail extends AiConversationSummary {
  readonly messages: readonly AiMessage[];
}

export interface AiSendMessageResult {
  readonly userMessage: AiMessage;
  readonly assistantMessage: AiMessage;
}

export type AiSendMessageStreamEvent =
  | { readonly type: 'delta'; readonly text: string }
  | { readonly type: 'done'; readonly userMessage: AiMessage; readonly assistantMessage: AiMessage }
  | { readonly type: 'error'; readonly message: string };

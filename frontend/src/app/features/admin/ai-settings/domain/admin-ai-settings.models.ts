export type AiProviderId =
  'GEMINI' | 'OPENAI' | 'ANTHROPIC' | 'OPENAI_COMPATIBLE' | 'ANTHROPIC_COMPATIBLE' | 'CUSTOM';

export type AiProtocol =
  'OPENAI_RESPONSES' | 'OPENAI_CHAT_COMPLETIONS' | 'ANTHROPIC_MESSAGES' | 'GEMINI_GENERATE_CONTENT';

export type AiAuthType = 'BEARER' | 'X_API_KEY' | 'API_KEY_HEADER' | 'QUERY_PARAM';

export const AI_PROVIDERS: readonly AiProviderId[] = [
  'GEMINI',
  'OPENAI',
  'ANTHROPIC',
  'OPENAI_COMPATIBLE',
  'ANTHROPIC_COMPATIBLE',
  'CUSTOM',
];

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  GEMINI: 'Gemini',
  OPENAI: 'ChatGPT (OpenAI)',
  ANTHROPIC: 'Claude (Anthropic)',
  OPENAI_COMPATIBLE: 'OpenAI Compatible',
  ANTHROPIC_COMPATIBLE: 'Anthropic Compatible',
  CUSTOM: 'Custom gateway',
};

export const AI_PROTOCOLS: readonly AiProtocol[] = [
  'OPENAI_RESPONSES',
  'OPENAI_CHAT_COMPLETIONS',
  'ANTHROPIC_MESSAGES',
  'GEMINI_GENERATE_CONTENT',
];

export const AI_PROTOCOL_LABELS: Record<AiProtocol, string> = {
  OPENAI_RESPONSES: 'OpenAI Responses',
  OPENAI_CHAT_COMPLETIONS: 'OpenAI Chat Completions',
  ANTHROPIC_MESSAGES: 'Anthropic Messages',
  GEMINI_GENERATE_CONTENT: 'Gemini Generate Content',
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

export const AI_CAPABILITY_KEYS = [
  'chat',
  'modelDiscovery',
  'streaming',
  'systemPrompt',
  'tools',
  'vision',
  'reasoning',
] as const;

export type AiCapabilityName = (typeof AI_CAPABILITY_KEYS)[number];

export const AI_CAPABILITY_LABELS: Record<AiCapabilityName, string> = {
  chat: 'Chat',
  modelDiscovery: 'Models',
  streaming: 'Streaming',
  systemPrompt: 'System prompt',
  tools: 'Tools',
  vision: 'Vision',
  reasoning: 'Reasoning',
};

export type AiCapabilities = Record<AiCapabilityName, boolean>;

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
  readonly capabilityModel: string | null;
  readonly capabilities: AiCapabilities | null;
  readonly capabilitiesProbedAt: string | null;
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
  readonly protocol?: AiProtocol;
}

export interface UpdateAiConnectionPayload {
  readonly name?: string;
  readonly apiKey?: string;
  readonly baseUrl?: string | null;
  readonly defaultModel?: string | null;
  readonly enabled?: boolean;
  readonly authType?: AiAuthType;
  readonly authHeaderName?: string | null;
  readonly protocol?: AiProtocol;
}

export interface AiConnectionTestResult {
  readonly ok: boolean;
  readonly message?: string;
}

export interface AiCapabilityProbeResult {
  readonly connectionId: string;
  readonly model: string;
  readonly capabilities: AiCapabilities;
  readonly probedAt: string;
  readonly failedChecks: readonly AiCapabilityName[];
}

export interface AiModelInfo {
  readonly id: string;
  readonly displayName?: string;
  readonly contextLength?: number;
  readonly maxOutputTokens?: number;
  readonly reasoning?: boolean;
  readonly vision?: boolean;
  readonly tools?: boolean;
}

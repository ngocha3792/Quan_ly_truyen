export type AiProviderId = 'GEMINI' | 'OPENAI' | 'ANTHROPIC' | 'OPENAI_COMPATIBLE';

export const AI_PROVIDERS: readonly AiProviderId[] = [
  'GEMINI',
  'OPENAI',
  'ANTHROPIC',
  'OPENAI_COMPATIBLE',
];

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  GEMINI: 'Gemini',
  OPENAI: 'ChatGPT',
  ANTHROPIC: 'Claude',
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

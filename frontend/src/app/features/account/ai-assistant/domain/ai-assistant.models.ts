export type AiProviderId = 'GEMINI' | 'OPENAI' | 'ANTHROPIC';

export const AI_PROVIDERS: readonly AiProviderId[] = ['GEMINI', 'OPENAI', 'ANTHROPIC'];

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  GEMINI: 'Gemini',
  OPENAI: 'ChatGPT',
  ANTHROPIC: 'Claude',
};

export interface AiKeyStatus {
  readonly provider: AiProviderId;
  readonly configured: boolean;
  readonly lastFour: string | null;
}

export interface AiConversationSummary {
  readonly id: string;
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

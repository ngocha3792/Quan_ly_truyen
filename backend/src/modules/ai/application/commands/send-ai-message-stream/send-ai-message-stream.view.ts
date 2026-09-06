import type { AiMessageRecord } from '../../ports/ai-conversation.persistence.port';

export type SendAiMessageStreamEvent =
  | { readonly type: 'delta'; readonly text: string }
  | {
      readonly type: 'done';
      readonly userMessage: AiMessageRecord;
      readonly assistantMessage: AiMessageRecord;
    };

import type { AiMessageRecord } from '../../ports/ai-conversation.persistence.port';
import type { AiUsageTokens } from '../../ports/ai-protocol-adapter.port';

export type SendAiMessageStreamEvent =
  | { readonly type: 'TEXT_DELTA'; readonly text: string }
  | { readonly type: 'USAGE'; readonly usage: AiUsageTokens }
  | {
      readonly type: 'DONE';
      readonly userMessage: AiMessageRecord;
      readonly assistantMessage: AiMessageRecord;
    };

import type { AiMessageRecord } from '../../ports/ai-conversation.persistence.port';

export interface SendAiMessageResultView {
  readonly userMessage: AiMessageRecord;
  readonly assistantMessage: AiMessageRecord;
}

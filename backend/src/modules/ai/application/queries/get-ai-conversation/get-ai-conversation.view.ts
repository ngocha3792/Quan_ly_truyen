import type {
  AiConversationRecord,
  AiMessageRecord,
} from '../../ports/ai-conversation.persistence.port';

export interface AiConversationDetailView {
  readonly conversation: AiConversationRecord;
  readonly messages: readonly AiMessageRecord[];
}

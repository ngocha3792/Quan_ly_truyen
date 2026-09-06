import type { AiMessageRole, AiProvider } from '@/generated/prisma/client';
import type {
  AiConversationRecord,
  AiMessageRecord,
} from '../../../application/ports/ai-conversation.persistence.port';
import type { AiConversationDetailView } from '../../../application/queries/get-ai-conversation/get-ai-conversation.view';
import type { SendAiMessageResultView } from '../../../application/commands/send-ai-message/send-ai-message.view';

export interface AiConversationSummaryResponse {
  readonly id: string;
  readonly provider: AiProvider;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AiMessageResponse {
  readonly id: string;
  readonly role: AiMessageRole;
  readonly content: string;
  readonly createdAt: string;
}

export interface AiConversationDetailResponse extends AiConversationSummaryResponse {
  readonly messages: readonly AiMessageResponse[];
}

export interface SendAiMessageResponse {
  readonly userMessage: AiMessageResponse;
  readonly assistantMessage: AiMessageResponse;
}

function toSummary(
  record: AiConversationRecord,
): AiConversationSummaryResponse {
  return {
    id: record.id,
    provider: record.provider,
    title: record.title,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toMessage(record: AiMessageRecord): AiMessageResponse {
  return {
    id: record.id,
    role: record.role,
    content: record.content,
    createdAt: record.createdAt.toISOString(),
  };
}

export function toAiConversationSummaryListResponse(
  records: readonly AiConversationRecord[],
): readonly AiConversationSummaryResponse[] {
  return records.map(toSummary);
}

export function toAiConversationDetailResponse(
  view: AiConversationDetailView,
): AiConversationDetailResponse {
  return {
    ...toSummary(view.conversation),
    messages: view.messages.map(toMessage),
  };
}

export function toSendAiMessageResponse(
  view: SendAiMessageResultView,
): SendAiMessageResponse {
  return {
    userMessage: toMessage(view.userMessage),
    assistantMessage: toMessage(view.assistantMessage),
  };
}

import { Observable } from 'rxjs';

import {
  AiConversationDetail,
  AiConversationSummary,
  AiKeyStatus,
  AiProviderId,
  AiSendMessageResult,
} from './ai-assistant.models';

export abstract class AiAssistantRepository {
  abstract listKeys(): Observable<readonly AiKeyStatus[]>;
  abstract saveKey(provider: AiProviderId, apiKey: string): Observable<void>;
  abstract removeKey(provider: AiProviderId): Observable<void>;

  abstract listConversations(): Observable<readonly AiConversationSummary[]>;
  abstract createConversation(
    provider: AiProviderId,
    title?: string,
  ): Observable<AiConversationSummary>;
  abstract getConversation(conversationId: string): Observable<AiConversationDetail>;
  abstract deleteConversation(conversationId: string): Observable<void>;
  abstract sendMessage(conversationId: string, content: string): Observable<AiSendMessageResult>;
}

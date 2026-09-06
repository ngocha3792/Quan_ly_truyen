import { Observable } from 'rxjs';

import {
  AiConnection,
  AiConnectionTestResult,
  AiConversationDetail,
  AiConversationSummary,
  AiSendMessageResult,
  CreateAiConnectionPayload,
  UpdateAiConnectionPayload,
} from './ai-assistant.models';

export abstract class AiAssistantRepository {
  abstract listConnections(): Observable<readonly AiConnection[]>;
  abstract createConnection(payload: CreateAiConnectionPayload): Observable<AiConnection>;
  abstract updateConnection(
    connectionId: string,
    payload: UpdateAiConnectionPayload,
  ): Observable<AiConnection>;
  abstract deleteConnection(connectionId: string): Observable<void>;
  abstract testConnection(connectionId: string): Observable<AiConnectionTestResult>;

  abstract listConversations(): Observable<readonly AiConversationSummary[]>;
  abstract createConversation(
    connectionId: string,
    title?: string,
  ): Observable<AiConversationSummary>;
  abstract getConversation(conversationId: string): Observable<AiConversationDetail>;
  abstract deleteConversation(conversationId: string): Observable<void>;
  abstract sendMessage(conversationId: string, content: string): Observable<AiSendMessageResult>;
}

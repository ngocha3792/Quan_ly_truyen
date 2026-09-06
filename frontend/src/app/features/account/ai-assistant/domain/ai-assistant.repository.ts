import { Observable } from 'rxjs';

import {
  AiConnection,
  AiCapabilityProbeResult,
  AiConnectionTestResult,
  AiModelInfo,
  AiFallbackPolicy,
  AiPolicy,
  AiProfile,
  AiConversationDetail,
  AiConversationSummary,
  AiSendMessageResult,
  AiSendMessageStreamEvent,
  CreateAiConnectionPayload,
  UpdateAiConnectionPayload,
  UpdateAiProfilePayload,
} from './ai-assistant.models';

export abstract class AiAssistantRepository {
  abstract getPolicy(): Observable<AiPolicy>;
  abstract updateFallbackPolicy(fallbackPolicy: AiFallbackPolicy): Observable<AiPolicy>;
  abstract getProfile(): Observable<AiProfile>;
  abstract updateProfile(payload: UpdateAiProfilePayload): Observable<AiProfile>;

  abstract listConnections(): Observable<readonly AiConnection[]>;
  abstract createConnection(payload: CreateAiConnectionPayload): Observable<AiConnection>;
  abstract updateConnection(
    connectionId: string,
    payload: UpdateAiConnectionPayload,
  ): Observable<AiConnection>;
  abstract deleteConnection(connectionId: string): Observable<void>;
  abstract testConnection(connectionId: string): Observable<AiConnectionTestResult>;
  abstract probeConnectionCapabilities(connectionId: string): Observable<AiCapabilityProbeResult>;
  abstract listModels(connectionId: string, refresh?: boolean): Observable<readonly AiModelInfo[]>;

  abstract listConversations(): Observable<readonly AiConversationSummary[]>;
  abstract createConversation(
    connectionId: string,
    modelId?: string,
    title?: string,
  ): Observable<AiConversationSummary>;
  abstract getConversation(conversationId: string): Observable<AiConversationDetail>;
  abstract deleteConversation(conversationId: string): Observable<void>;
  abstract sendMessage(conversationId: string, content: string): Observable<AiSendMessageResult>;
  abstract sendMessageStream(
    conversationId: string,
    content: string,
  ): Observable<AiSendMessageStreamEvent>;
}

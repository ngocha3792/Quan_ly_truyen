import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import { AiAssistantRepository } from '../domain/ai-assistant.repository';
import {
  AiConnection,
  AiConnectionTestResult,
  AiConversationDetail,
  AiConversationSummary,
  AiSendMessageResult,
  CreateAiConnectionPayload,
  UpdateAiConnectionPayload,
} from '../domain/ai-assistant.models';

@Injectable()
export class AiAssistantHttpRepository implements AiAssistantRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly connectionsUrl = `${this.config.apiBaseUrl}/ai/connections`;
  private readonly conversationsUrl = `${this.config.apiBaseUrl}/ai/conversations`;

  listConnections(): Observable<readonly AiConnection[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly AiConnection[]>>(this.connectionsUrl)
      .pipe(map((response) => response.data));
  }

  createConnection(payload: CreateAiConnectionPayload): Observable<AiConnection> {
    return this.http
      .post<ApiSuccessEnvelope<AiConnection>>(this.connectionsUrl, payload)
      .pipe(map((response) => response.data));
  }

  updateConnection(
    connectionId: string,
    payload: UpdateAiConnectionPayload,
  ): Observable<AiConnection> {
    return this.http
      .patch<ApiSuccessEnvelope<AiConnection>>(`${this.connectionsUrl}/${connectionId}`, payload)
      .pipe(map((response) => response.data));
  }

  deleteConnection(connectionId: string): Observable<void> {
    return this.http.delete<void>(`${this.connectionsUrl}/${connectionId}`);
  }

  testConnection(connectionId: string): Observable<AiConnectionTestResult> {
    return this.http
      .post<ApiSuccessEnvelope<AiConnectionTestResult>>(
        `${this.connectionsUrl}/${connectionId}/test`,
        {},
      )
      .pipe(map((response) => response.data));
  }

  listConversations(): Observable<readonly AiConversationSummary[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly AiConversationSummary[]>>(this.conversationsUrl)
      .pipe(map((response) => response.data));
  }

  createConversation(connectionId: string, title?: string): Observable<AiConversationSummary> {
    return this.http
      .post<ApiSuccessEnvelope<AiConversationSummary>>(this.conversationsUrl, {
        connectionId,
        title,
      })
      .pipe(map((response) => response.data));
  }

  getConversation(conversationId: string): Observable<AiConversationDetail> {
    return this.http
      .get<ApiSuccessEnvelope<AiConversationDetail>>(`${this.conversationsUrl}/${conversationId}`)
      .pipe(map((response) => response.data));
  }

  deleteConversation(conversationId: string): Observable<void> {
    return this.http.delete<void>(`${this.conversationsUrl}/${conversationId}`);
  }

  sendMessage(conversationId: string, content: string): Observable<AiSendMessageResult> {
    return this.http
      .post<ApiSuccessEnvelope<AiSendMessageResult>>(
        `${this.conversationsUrl}/${conversationId}/messages`,
        { content },
      )
      .pipe(map((response) => response.data));
  }
}

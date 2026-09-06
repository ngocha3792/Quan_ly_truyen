import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import { AiAssistantRepository } from '../domain/ai-assistant.repository';
import {
  AiConversationDetail,
  AiConversationSummary,
  AiKeyStatus,
  AiProviderId,
  AiSendMessageResult,
} from '../domain/ai-assistant.models';

@Injectable()
export class AiAssistantHttpRepository implements AiAssistantRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly keysUrl = `${this.config.apiBaseUrl}/ai/keys`;
  private readonly conversationsUrl = `${this.config.apiBaseUrl}/ai/conversations`;

  listKeys(): Observable<readonly AiKeyStatus[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly AiKeyStatus[]>>(this.keysUrl)
      .pipe(map((response) => response.data));
  }

  saveKey(provider: AiProviderId, apiKey: string): Observable<void> {
    return this.http.put<void>(`${this.keysUrl}/${provider}`, { apiKey });
  }

  removeKey(provider: AiProviderId): Observable<void> {
    return this.http.delete<void>(`${this.keysUrl}/${provider}`);
  }

  listConversations(): Observable<readonly AiConversationSummary[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly AiConversationSummary[]>>(this.conversationsUrl)
      .pipe(map((response) => response.data));
  }

  createConversation(provider: AiProviderId, title?: string): Observable<AiConversationSummary> {
    return this.http
      .post<ApiSuccessEnvelope<AiConversationSummary>>(this.conversationsUrl, {
        provider,
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

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { TokenStore } from '../../../../core/auth/token.store';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import { readBrowserCookie } from '../../../../core/http/browser-cookie.util';
import { AiAssistantRepository } from '../domain/ai-assistant.repository';
import {
  AiConnection,
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
} from '../domain/ai-assistant.models';

const STREAM_FALLBACK_ERROR_MESSAGE = 'Không thể kết nối tới máy chủ AI. Vui lòng thử lại.';

@Injectable()
export class AiAssistantHttpRepository implements AiAssistantRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly tokenStore = inject(TokenStore);
  private readonly connectionsUrl = `${this.config.apiBaseUrl}/ai/connections`;
  private readonly conversationsUrl = `${this.config.apiBaseUrl}/ai/conversations`;
  private readonly policyUrl = `${this.config.apiBaseUrl}/ai/policy`;
  private readonly profileUrl = `${this.config.apiBaseUrl}/ai/profile`;

  getPolicy(): Observable<AiPolicy> {
    return this.http
      .get<ApiSuccessEnvelope<AiPolicy>>(this.policyUrl)
      .pipe(map((response) => response.data));
  }

  updateFallbackPolicy(fallbackPolicy: AiFallbackPolicy): Observable<AiPolicy> {
    return this.http
      .patch<ApiSuccessEnvelope<AiPolicy>>(this.policyUrl, { fallbackPolicy })
      .pipe(map((response) => response.data));
  }

  getProfile(): Observable<AiProfile> {
    return this.http
      .get<ApiSuccessEnvelope<AiProfile>>(this.profileUrl)
      .pipe(map((response) => response.data));
  }

  updateProfile(payload: UpdateAiProfilePayload): Observable<AiProfile> {
    return this.http
      .patch<ApiSuccessEnvelope<AiProfile>>(this.profileUrl, payload)
      .pipe(map((response) => response.data));
  }

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

  listModels(connectionId: string, refresh = false): Observable<readonly AiModelInfo[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly AiModelInfo[]>>(
        `${this.connectionsUrl}/${connectionId}/models`,
        { params: refresh ? { refresh: 'true' } : {} },
      )
      .pipe(map((response) => response.data));
  }

  listConversations(): Observable<readonly AiConversationSummary[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly AiConversationSummary[]>>(this.conversationsUrl)
      .pipe(map((response) => response.data));
  }

  createConversation(
    connectionId: string,
    modelId?: string,
    title?: string,
  ): Observable<AiConversationSummary> {
    return this.http
      .post<ApiSuccessEnvelope<AiConversationSummary>>(this.conversationsUrl, {
        connectionId,
        modelId,
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

  sendMessageStream(conversationId: string, content: string): Observable<AiSendMessageStreamEvent> {
    const url = `${this.conversationsUrl}/${conversationId}/messages/stream`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    const accessToken = this.tokenStore.accessToken();
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    if (this.config.csrf.enabled) {
      const csrfToken = readBrowserCookie(this.config.csrf.cookieName);
      if (csrfToken) {
        headers[this.config.csrf.headerName] = csrfToken;
      }
    }

    return new Observable<AiSendMessageStreamEvent>((subscriber) => {
      const controller = new AbortController();

      fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ content }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok || !response.body) {
            subscriber.next({ type: 'error', message: STREAM_FALLBACK_ERROR_MESSAGE });
            subscriber.complete();
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            let separatorIndex = buffer.indexOf('\n\n');
            while (separatorIndex !== -1) {
              const rawEvent = buffer.slice(0, separatorIndex);
              buffer = buffer.slice(separatorIndex + 2);

              const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data:'));
              if (dataLine) {
                const event = this.parseStreamEvent(dataLine.slice(5).trim());
                if (event) {
                  subscriber.next(event);
                  if (event.type === 'done' || event.type === 'error') {
                    subscriber.complete();
                    return;
                  }
                }
              }

              separatorIndex = buffer.indexOf('\n\n');
            }
          }

          subscriber.complete();
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          subscriber.next({
            type: 'error',
            message: error instanceof Error ? error.message : STREAM_FALLBACK_ERROR_MESSAGE,
          });
          subscriber.complete();
        });

      return () => controller.abort();
    });
  }

  private parseStreamEvent(json: string): AiSendMessageStreamEvent | null {
    try {
      return JSON.parse(json) as AiSendMessageStreamEvent;
    } catch {
      return null;
    }
  }
}

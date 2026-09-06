import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import {
  AiConnection,
  AiCapabilityProbeResult,
  AiConnectionTestResult,
  AiModelInfo,
  CreateAiConnectionPayload,
  UpdateAiConnectionPayload,
} from '../domain/admin-ai-settings.models';

@Injectable({ providedIn: 'root' })
export class AdminAiSettingsApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly url = `${this.config.apiBaseUrl}/admin/ai/connections`;

  list(): Observable<readonly AiConnection[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly AiConnection[]>>(this.url)
      .pipe(map((response) => response.data));
  }

  create(payload: CreateAiConnectionPayload): Observable<AiConnection> {
    return this.http
      .post<ApiSuccessEnvelope<AiConnection>>(this.url, payload)
      .pipe(map((response) => response.data));
  }

  update(connectionId: string, payload: UpdateAiConnectionPayload): Observable<AiConnection> {
    return this.http
      .patch<ApiSuccessEnvelope<AiConnection>>(`${this.url}/${connectionId}`, payload)
      .pipe(map((response) => response.data));
  }

  remove(connectionId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${connectionId}`);
  }

  test(connectionId: string): Observable<AiConnectionTestResult> {
    return this.http
      .post<ApiSuccessEnvelope<AiConnectionTestResult>>(`${this.url}/${connectionId}/test`, {})
      .pipe(map((response) => response.data));
  }

  probeCapabilities(connectionId: string): Observable<AiCapabilityProbeResult> {
    return this.http
      .post<ApiSuccessEnvelope<AiCapabilityProbeResult>>(
        `${this.url}/${connectionId}/capabilities/probe`,
        {},
      )
      .pipe(map((response) => response.data));
  }

  listModels(connectionId: string, refresh = false): Observable<readonly AiModelInfo[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly AiModelInfo[]>>(`${this.url}/${connectionId}/models`, {
        params: refresh ? { refresh: 'true' } : {},
      })
      .pipe(map((response) => response.data));
  }
}

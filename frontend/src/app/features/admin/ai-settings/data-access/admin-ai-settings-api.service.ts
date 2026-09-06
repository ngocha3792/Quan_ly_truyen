import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import { AiProviderId, AiProviderKeyStatus } from '../domain/admin-ai-settings.models';

@Injectable({ providedIn: 'root' })
export class AdminAiSettingsApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly url = `${this.config.apiBaseUrl}/admin/ai/keys`;

  list(): Observable<readonly AiProviderKeyStatus[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly AiProviderKeyStatus[]>>(this.url)
      .pipe(map((response) => response.data));
  }

  save(provider: AiProviderId, apiKey: string): Observable<void> {
    return this.http.put<void>(`${this.url}/${provider}`, { apiKey });
  }

  remove(provider: AiProviderId): Observable<void> {
    return this.http.delete<void>(`${this.url}/${provider}`);
  }
}

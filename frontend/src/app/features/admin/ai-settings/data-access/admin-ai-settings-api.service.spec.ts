import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { AdminAiSettingsApiService } from './admin-ai-settings-api.service';

describe('AdminAiSettingsApiService', () => {
  let service: AdminAiSettingsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: APP_RUNTIME_CONFIG,
          useValue: {
            apiBaseUrl: '/api/v1',
            appName: 'TruyenHub',
            production: false,
          },
        },
      ],
    });

    service = TestBed.inject(AdminAiSettingsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('refresh model discovery bằng query refresh=true và giữ metadata', async () => {
    const resultPromise = firstValueFrom(service.listModels('connection-id', true));
    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/v1/admin/ai/connections/connection-id/models' &&
        candidate.params.get('refresh') === 'true',
    );

    expect(request.request.method).toBe('GET');
    request.flush({
      success: true,
      data: [
        {
          id: 'model-1',
          displayName: 'Model One',
          contextLength: 128000,
          maxOutputTokens: 8192,
        },
      ],
      requestId: 'request-test',
      timestamp: '2026-09-06T12:00:00.000Z',
    });

    await expect(resultPromise).resolves.toEqual([
      {
        id: 'model-1',
        displayName: 'Model One',
        contextLength: 128000,
        maxOutputTokens: 8192,
      },
    ]);
  });

  it('gửi protocol rõ ràng khi tạo custom gateway', async () => {
    const payload = {
      name: 'Company gateway',
      provider: 'CUSTOM' as const,
      apiKey: 'secret-value',
      baseUrl: 'https://gateway.example.com/v1',
      defaultModel: 'company-model',
      protocol: 'OPENAI_CHAT_COMPLETIONS' as const,
      authType: 'API_KEY_HEADER' as const,
      authHeaderName: 'X-Company-Key',
    };
    const resultPromise = firstValueFrom(service.create(payload));
    const request = http.expectOne('/api/v1/admin/ai/connections');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({
      success: true,
      data: {
        id: 'connection-id',
        ...payload,
        vendorHint: 'CUSTOM',
        enabled: true,
        createdAt: '2026-09-06T12:00:00.000Z',
        updatedAt: '2026-09-06T12:00:00.000Z',
      },
      requestId: 'request-test',
      timestamp: '2026-09-06T12:00:00.000Z',
    });

    await expect(resultPromise).resolves.toMatchObject({
      id: 'connection-id',
      protocol: 'OPENAI_CHAT_COMPLETIONS',
    });
  });

  it('chỉ probe capability khi gọi endpoint chủ động', async () => {
    const resultPromise = firstValueFrom(service.probeCapabilities('connection-id'));
    const request = http.expectOne('/api/v1/admin/ai/connections/connection-id/capabilities/probe');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({
      success: true,
      data: {
        connectionId: 'connection-id',
        model: 'model-1',
        capabilities: {
          chat: true,
          modelDiscovery: true,
          streaming: true,
          systemPrompt: true,
          tools: false,
          vision: false,
          reasoning: true,
        },
        probedAt: '2026-09-06T16:30:00.000Z',
        failedChecks: [],
      },
      requestId: 'request-test',
      timestamp: '2026-09-06T16:30:00.000Z',
    });

    await expect(resultPromise).resolves.toMatchObject({
      model: 'model-1',
      capabilities: { streaming: true, tools: false },
    });
  });
});

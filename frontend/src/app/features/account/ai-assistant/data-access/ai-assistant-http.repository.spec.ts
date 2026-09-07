import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { AiAssistantHttpRepository } from './ai-assistant-http.repository';

describe('AiAssistantHttpRepository usage', () => {
  let repository: AiAssistantHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AiAssistantHttpRepository,
        {
          provide: APP_RUNTIME_CONFIG,
          useValue: {
            apiBaseUrl: '/api/v1',
            appName: 'TruyenHub',
            production: false,
            csrf: { enabled: false },
          },
        },
      ],
    });
    repository = TestBed.inject(AiAssistantHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('đọc usage và quota của user theo date range', async () => {
    const resultPromise = firstValueFrom(repository.getUsage('2026-09-01', '2026-09-07'));
    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/v1/ai/usage' &&
        candidate.params.get('from') === '2026-09-01' &&
        candidate.params.get('to') === '2026-09-07',
    );

    expect(request.request.method).toBe('GET');
    request.flush({
      success: true,
      data: {
        range: { from: '2026-09-01', to: '2026-09-07', timeZone: 'UTC' },
        totals: { requests: 3, inputTokens: 120, outputTokens: 40 },
        byModel: [],
        byConnection: [],
        quota: { tier: 'FREE' },
        pricing: { status: 'NOT_CONFIGURED', currency: 'USD', estimatedCost: null },
      },
      requestId: 'request-test',
      timestamp: '2026-09-07T12:00:00.000Z',
    });

    await expect(resultPromise).resolves.toMatchObject({
      totals: { requests: 3, inputTokens: 120, outputTokens: 40 },
      quota: { tier: 'FREE' },
    });
  });
});

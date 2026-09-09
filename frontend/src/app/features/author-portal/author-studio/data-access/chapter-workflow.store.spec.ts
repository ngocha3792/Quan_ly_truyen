import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ChapterWorkflow } from '../domain/chapter-editing.models';
import { ChapterLocalRecoveryService } from './chapter-local-recovery.service';
import { ChapterWorkflowStore } from './chapter-workflow.store';

describe('ChapterWorkflowStore contract', () => {
  let store: ChapterWorkflowStore;
  let http: HttpTestingController;
  const url = '/api/v1/author/stories/story/chapters/chapter';
  const approved: ChapterWorkflow = {
    status: 'APPROVED',
    version: 7,
    canEdit: false,
    canSubmit: false,
    canPublish: false,
    canReopen: true,
    reviews: [],
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ChapterWorkflowStore,
        { provide: ChapterLocalRecoveryService, useValue: { tabId: 'tab' } },
        { provide: APP_RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    store = TestBed.inject(ChapterWorkflowStore);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  async function start(): Promise<void> {
    const pending = store.start('story', 'chapter');
    http.expectOne(`${url}/workflow`).flush({ data: approved });
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne(`${url}/workflow`).flush({ data: approved });
    await pending;
  }

  it('keeps reopen independent from publish capability', async () => {
    await start();
    expect(store.workflow()?.canReopen).toBe(true);
    expect(store.workflow()?.canPublish).toBe(false);
    http.expectNone(`${url}/edit-sessions`);
  });

  it.each(['submit-review', 'reopen'] as const)(
    'sends expectedVersion and idempotency for %s',
    async (action) => {
      await start();
      const pending = store.transition(action, 7);
      const request = http.expectOne(`${url}/${action}`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ expectedVersion: 7 });
      expect(request.request.headers.get('x-idempotency-key')).toBeTruthy();
      request.flush({ data: { id: 'chapter', version: 8 } });
      await Promise.resolve();
      await Promise.resolve();
      http.expectOne(`${url}/workflow`).flush({ data: { ...approved, version: 8 } });
      await expect(pending).resolves.toMatchObject({ version: 8 });
    },
  );

  it('reuses the key when retrying an unacknowledged transition', async () => {
    await start();
    const first = store.transition('reopen', 7).catch(() => null);
    const request = http.expectOne(`${url}/reopen`);
    const key = request.request.headers.get('x-idempotency-key');
    request.error(new ProgressEvent('error'));
    await first;
    const retry = store.transition('reopen', 7);
    const second = http.expectOne(`${url}/reopen`);
    expect(second.request.headers.get('x-idempotency-key')).toBe(key);
    second.flush({ data: { id: 'chapter', version: 8 } });
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne(`${url}/workflow`).flush({ data: { ...approved, version: 8 } });
    await retry;
  });
});

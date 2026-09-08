import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthStore } from '../../../../core/auth/auth.store';
import { TokenStore } from '../../../../core/auth/token.store';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ReaderEngagementApiClient } from '../../../../core/http/reader-engagement-api.client';
import type { ReadingHistoryApiItem } from '../../../../core/http/reader-engagement-api.model';
import type { ChapterReaderView } from '../domain/chapter-reader.models';
import { ReadingProgressSyncService } from './reading-progress-sync.service';
import { ReadingProgressLocalState } from './reading-progress-local-state';

const socketHarness = vi.hoisted(() => {
  const handlers = new Map<string, (...args: never[]) => void>();
  return {
    handlers,
    socket: {
      connected: false,
      on: vi.fn((name: string, handler: (...args: never[]) => void) => {
        handlers.set(name, handler);
      }),
      emit: vi.fn(),
      disconnect: vi.fn(),
    },
    io: vi.fn(),
  };
});

vi.mock('socket.io-client', () => ({
  io: socketHarness.io,
}));

describe('ReadingProgressSyncService', () => {
  const api = {
    getReadingProgress: vi.fn(),
    saveReadingProgress: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    socketHarness.handlers.clear();
    socketHarness.socket.connected = false;
    socketHarness.socket.on.mockClear();
    socketHarness.socket.emit.mockClear();
    socketHarness.socket.disconnect.mockClear();
    socketHarness.io.mockReset();
    socketHarness.io.mockReturnValue(socketHarness.socket);
    api.getReadingProgress.mockReturnValue(of(null));
    api.saveReadingProgress.mockReturnValue(of(progress(1, '1')));

    document.body.innerHTML = `
      <article data-reader-chapter-id="chapter-1">
        <p data-block-id="11111111-1111-4111-8111-111111111111">Content</p>
      </article>
    `;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: window.innerHeight,
      height: window.innerHeight,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    TestBed.configureTestingModule({
      providers: [
        ReadingProgressSyncService,
        ReadingProgressLocalState,
        { provide: ReaderEngagementApiClient, useValue: api },
        { provide: AuthStore, useValue: { user: () => ({ id: 'user-1' }) } },
        { provide: TokenStore, useValue: { accessToken: () => 'access-token' } },
        {
          provide: APP_RUNTIME_CONFIG,
          useValue: {
            apiBaseUrl: 'http://localhost:3000/api/v1',
            features: { realtimeProgressSyncEnabled: true },
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('replays the same offline event after reconnect so the server can deduplicate it', () => {
    const pending = updateEvent();
    localStorage.setItem('qlt:reading-progress:pending:user-1:story-1', JSON.stringify(pending));
    const service = TestBed.inject(ReadingProgressSyncService);
    service.start(view());

    socketHarness.socket.connected = true;
    socketHarness.handlers.get('connect')?.();
    expect(socketHarness.socket.emit).toHaveBeenLastCalledWith('progress:update', pending);

    socketHarness.handlers.get('disconnect')?.();
    socketHarness.handlers.get('connect')?.();
    expect(socketHarness.socket.emit).toHaveBeenCalledTimes(2);
  });

  it('coalesces pixel scrolls into at most one REST fallback write per three seconds', () => {
    const service = TestBed.inject(ReadingProgressSyncService);
    service.start(view());
    service.capture();
    service.capture();

    vi.advanceTimersByTime(2_999);
    expect(api.saveReadingProgress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(api.saveReadingProgress).toHaveBeenCalledTimes(1);
  });

  it('drops a stale pending event on conflict instead of retrying over newer state', () => {
    const service = TestBed.inject(ReadingProgressSyncService);
    service.start(view());
    vi.advanceTimersByTime(3_000);
    const sent = socketHarness.socket.emit.mock.calls.find(
      ([name]) => name === 'progress:update',
    )?.[1] as { clientEventId: string } | undefined;
    expect(sent).toBeUndefined();

    const pending = updateEvent();
    localStorage.setItem('qlt:reading-progress:pending:user-1:story-1', JSON.stringify(pending));
    socketHarness.handlers.get('progress:conflict')?.({
      storyId: 'story-1',
      clientEventId: pending.clientEventId,
      actualRevision: 4,
      progress: progress(4, '9'),
    } as never);

    expect(localStorage.getItem('qlt:reading-progress:pending:user-1:story-1')).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(socketHarness.socket.emit).not.toHaveBeenCalled();
  });
});

function view(): ChapterReaderView {
  return {
    story: { id: 'story-1', slug: 'story-one', title: 'Story One' },
    chapter: {
      id: 'chapter-1',
      number: 1,
      title: 'Chapter One',
      paragraphs: ['Content'],
      blocks: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          type: 'paragraph',
          text: 'Content',
        },
      ],
      publishedAt: '2026-09-08T00:00:00.000Z',
      views: 1,
      accessState: 'FREE',
      priceCredits: null,
    },
    navigation: { previous: null, next: null },
    comments: [],
    totalComments: 0,
  };
}

function updateEvent() {
  return {
    storyId: 'story-1',
    chapterId: 'chapter-1',
    position: 0,
    cursor: {
      schemaVersion: 1,
      kind: 'text',
      blockId: '11111111-1111-4111-8111-111111111111',
      characterOffset: 0,
      viewportRatio: 0,
    },
    baseRevision: 0,
    deviceId: '22222222-2222-4222-8222-222222222222',
    clientEventId: '33333333-3333-4333-8333-333333333333',
  } as const;
}

function progress(revision: number, sequence: string): ReadingHistoryApiItem {
  return {
    story: {
      id: 'story-1',
      slug: 'story-one',
      title: 'Story One',
      author: 'Author',
      coverUrl: null,
      categories: [],
      latestChapterNumber: 1,
      chapterCount: 1,
    },
    currentChapter: { id: 'chapter-1', number: 1, title: 'Chapter One' },
    position: 0,
    cursor: updateEvent().cursor,
    revision,
    deviceId: null,
    clientEventId: null,
    lastServerSequence: sequence,
    progressPercent: 100,
    lastReadAt: '2026-09-08T00:00:00.000Z',
  };
}

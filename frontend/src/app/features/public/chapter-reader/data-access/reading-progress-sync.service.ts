import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, OnDestroy, PLATFORM_ID } from '@angular/core';
import { Socket, io } from 'socket.io-client';

import { TokenStore } from '../../../../core/auth/token.store';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ReaderEngagementApiClient } from '../../../../core/http/reader-engagement-api.client';
import type {
  ReadingCursorApi,
  ReadingHistoryApiItem,
} from '../../../../core/http/reader-engagement-api.model';
import type { ChapterReaderView } from '../domain/chapter-reader.models';
import type {
  ProgressAckEvent,
  ProgressChangedEvent,
  ProgressConflictEvent,
  ProgressUpdateEvent,
  ReadingProgressClientEvents,
  ReadingProgressServerEvents,
} from './reading-progress-sync.events';
import { progressSendDelay, READING_PROGRESS_NAMESPACE } from './reading-progress-sync.events';
import { ReadingProgressLocalState, readingProgressDeviceId } from './reading-progress-local-state';
import { readVisibleTextCursor, restoreTextCursor } from './reading-progress-cursor.reader';

@Injectable()
export class ReadingProgressSyncService implements OnDestroy {
  private readonly api = inject(ReaderEngagementApiClient);
  private readonly localState = inject(ReadingProgressLocalState);
  private readonly tokens = inject(TokenStore);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  private socket: Socket<ReadingProgressServerEvents, ReadingProgressClientEvents> | null = null;
  private activeView: ChapterReaderView | null = null;
  private revision = 0;
  private lastServerSequence = 0n;
  private lastSentAt = 0;
  private latestCursor: ReadingCursorApi | null = null;
  private lastObservedBlockId: string | null = null;
  private inFlight = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  start(view: ChapterReaderView): void {
    if (!this.browser || !this.config.features.realtimeProgressSyncEnabled) return;
    const changedStory = this.activeView?.story.id !== view.story.id;
    const changedChapter = this.activeView?.chapter.id !== view.chapter.id;
    this.activeView = view;
    if (changedStory) {
      this.revision = 0;
      this.lastServerSequence = 0n;
      this.lastObservedBlockId = null;
      this.latestCursor = null;
      this.inFlight = false;
    }
    if (changedChapter) {
      this.lastObservedBlockId = null;
      this.latestCursor = null;
    }
    const requestedStoryId = view.story.id;
    this.api.getReadingProgress(requestedStoryId).subscribe({
      next: (progress) => {
        if (this.activeView?.story.id !== requestedStoryId) return;
        this.adopt(progress);
        restoreTextCursor(this.document, this.activeView?.chapter.id, progress);
        this.connect();
        this.capture();
      },
      error: () => {
        if (this.activeView?.story.id !== requestedStoryId) return;
        this.connect();
        this.capture();
      },
    });
  }

  capture(): void {
    const cursor = this.readVisibleCursor();
    if (!cursor) return;
    const changedBlock = cursor.blockId !== this.lastObservedBlockId;
    this.lastObservedBlockId = cursor.blockId;
    this.latestCursor = cursor;
    this.schedule(changedBlock);
  }

  flush(): void {
    if (!this.browser || !this.activeView) return;
    const cursor = this.readVisibleCursor();
    if (cursor) this.latestCursor = cursor;
    this.clearTimer();
    if (!this.latestCursor || this.inFlight) return;

    const event = this.createEvent(this.latestCursor);
    this.latestCursor = null;
    this.localState.persist(event);
    if (this.socket?.connected) {
      this.inFlight = true;
      this.socket.emit('progress:update', event);
      return;
    }

    const token = this.tokens.accessToken();
    if (!token) return;
    void fetch(`${this.config.apiBaseUrl}/reading-progress/${encodeURIComponent(event.storyId)}`, {
      method: 'PUT',
      keepalive: true,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chapterId: event.chapterId,
        position: event.position,
        cursor: event.cursor,
        sync: {
          baseRevision: event.baseRevision,
          deviceId: event.deviceId,
          clientEventId: event.clientEventId,
        },
      }),
    }).catch(() => undefined);
  }

  ngOnDestroy(): void {
    this.flush();
    this.clearTimer();
    this.socket?.disconnect();
    this.socket = null;
  }

  private connect(): void {
    const token = this.tokens.accessToken();
    if (!token || this.socket) return;
    const origin = new URL(this.config.apiBaseUrl, window.location.origin).origin;
    this.socket = io(`${origin}${READING_PROGRESS_NAMESPACE}`, {
      auth: { accessToken: token },
      transports: ['websocket'],
      reconnection: true,
    });
    this.socket.on('connect', () => this.replayPending());
    this.socket.on('disconnect', () => {
      this.inFlight = false;
    });
    this.socket.on('progress:ack', (event) => this.onAck(event));
    this.socket.on('progress:changed', (event) => this.onChanged(event));
    this.socket.on('progress:conflict', (event) => this.onConflict(event));
    this.socket.on('progress:error', (event) => {
      this.inFlight = false;
      if (
        event.code === 'READING_PROGRESS_RATE_LIMITED' ||
        event.code === 'READING_PROGRESS_UPDATE_REJECTED'
      ) {
        this.timer = setTimeout(() => this.replayPending(), progressSendDelay(false, 0));
      } else if (event.code === 'READING_PROGRESS_PAYLOAD_INVALID') {
        this.localState.clear(this.activeView?.story.id);
      }
    });
  }

  private sendLatest(): void {
    if (!this.latestCursor || !this.activeView || this.inFlight) return;
    const event = this.createEvent(this.latestCursor);
    this.latestCursor = null;
    this.lastSentAt = Date.now();
    this.inFlight = true;
    this.localState.persist(event);

    if (this.socket?.connected) {
      this.socket.emit('progress:update', event);
      return;
    }

    this.api
      .saveReadingProgress(event.storyId, event.chapterId, event.position, event.cursor, {
        baseRevision: event.baseRevision,
        deviceId: event.deviceId,
        clientEventId: event.clientEventId,
      })
      .subscribe({
        next: (progress) =>
          this.onAck({
            storyId: event.storyId,
            clientEventId: event.clientEventId,
            progress,
          }),
        error: () => {
          this.inFlight = false;
          this.connect();
        },
      });
  }

  private replayPending(): void {
    if (!this.socket?.connected || this.inFlight) return;
    const event = this.localState.read(this.activeView?.story.id);
    if (!event) {
      this.sendLatest();
      return;
    }
    this.inFlight = true;
    this.socket.emit('progress:update', event);
  }

  private onAck(event: ProgressAckEvent): void {
    if (event.storyId !== this.activeView?.story.id) return;
    const pending = this.localState.read(this.activeView?.story.id);
    if (pending?.clientEventId === event.clientEventId) {
      this.localState.clear(this.activeView?.story.id);
    }
    this.inFlight = false;
    this.adopt(event.progress);
    this.schedule(false);
  }

  private onChanged(event: ProgressChangedEvent): void {
    if (event.storyId !== this.activeView?.story.id) return;
    if (event.sourceDeviceId === readingProgressDeviceId()) return;
    if (BigInt(event.progress.lastServerSequence) <= this.lastServerSequence) return;
    this.adopt(event.progress);
    this.latestCursor = null;
    this.clearTimer();
    restoreTextCursor(this.document, this.activeView?.chapter.id, event.progress);
  }

  private onConflict(event: ProgressConflictEvent): void {
    if (event.storyId !== this.activeView?.story.id) return;
    const pending = this.localState.read(this.activeView?.story.id);
    if (pending?.clientEventId === event.clientEventId) {
      this.localState.clear(this.activeView?.story.id);
    }
    this.inFlight = false;
    this.revision = event.actualRevision;
    this.adopt(event.progress);
    restoreTextCursor(this.document, this.activeView?.chapter.id, event.progress);
    // A stale tab adopts server state; it must not retry and overwrite it.
    this.latestCursor = null;
  }

  private adopt(progress: ReadingHistoryApiItem | null): void {
    if (!progress) return;
    this.revision = Math.max(this.revision, progress.revision);
    this.lastServerSequence = BigInt(progress.lastServerSequence);
  }

  private schedule(blockChanged: boolean): void {
    if (!this.latestCursor || this.inFlight) return;
    this.clearTimer();
    const elapsed = Date.now() - this.lastSentAt;
    const delay = progressSendDelay(blockChanged, elapsed);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.sendLatest();
    }, delay);
  }

  private readVisibleCursor(): Extract<ReadingCursorApi, { kind: 'text' }> | null {
    const view = this.activeView;
    return view ? readVisibleTextCursor(this.document, view.chapter.id) : null;
  }

  private createEvent(cursor: ReadingCursorApi): ProgressUpdateEvent {
    const view = this.activeView!;
    return {
      storyId: view.story.id,
      chapterId: view.chapter.id,
      position: cursor.kind === 'text' ? cursor.characterOffset : 0,
      cursor,
      baseRevision: this.revision,
      deviceId: readingProgressDeviceId(),
      clientEventId: crypto.randomUUID(),
    };
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

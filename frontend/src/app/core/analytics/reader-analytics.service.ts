import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { catchError, EMPTY, map, of, retry, timer } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import type { ApiSuccessEnvelope } from '../http/api-envelope.model';
import type { ReaderAnalyticsEvent, ReaderAnalyticsPublicConfig } from './reader-analytics.models';

const ANONYMOUS_KEY = 'truyenhub.reader-analytics-anonymous-id';
const DEFAULT_CONFIG: ReaderAnalyticsPublicConfig = {
  enabled: true,
  maxBatchSize: 50,
  completionThresholdPercent: 90,
  progressHeartbeatSeconds: 15,
};

@Injectable({ providedIn: 'root' })
export class ReaderAnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(APP_RUNTIME_CONFIG);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly browser = isPlatformBrowser(this.platformId);
  private readonly pending: ReaderAnalyticsEvent[] = [];
  private config: ReaderAnalyticsPublicConfig = DEFAULT_CONFIG;
  private flushTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    if (this.browser) {
      this.loadConfig();
      this.destroyRef.onDestroy(() => this.clearFlushTimer());
    }
  }

  newSessionId(): string {
    return this.uuid();
  }

  storyView(storyId: string, sessionId = this.newSessionId()): void {
    this.enqueue({ type: 'STORY_VIEW', storyId, sessionId });
  }

  chapterView(storyId: string, chapterId: string, sessionId: string): void {
    this.enqueue({ type: 'CHAPTER_VIEW', storyId, chapterId, sessionId });
  }

  startChapterSession(input: {
    storyId: string;
    chapterId: string;
    sessionId: string;
  }): () => void {
    if (!this.browser || !this.config.enabled) return () => undefined;

    let started = false;
    let completed = false;
    let lastHeartbeatAt = Date.now();
    let lastActivityAt = Date.now();
    let lastProgress = 0;
    const onActivity = () => {
      lastActivityAt = Date.now();
    };
    const listeners: Array<[keyof WindowEventMap, EventListener]> = [
      ['scroll', onActivity as EventListener],
      ['pointerdown', onActivity as EventListener],
      ['keydown', onActivity as EventListener],
      ['touchstart', onActivity as EventListener],
    ];
    for (const [name, listener] of listeners) {
      window.addEventListener(name, listener, { passive: true });
    }

    const startTimer = setTimeout(() => {
      if (document.hidden) return;
      started = true;
      this.enqueue({
        type: 'READING_STARTED',
        storyId: input.storyId,
        chapterId: input.chapterId,
        sessionId: input.sessionId,
      });
    }, 5_000);

    const heartbeatMs = Math.max(5, this.config.progressHeartbeatSeconds) * 1000;
    const heartbeat = setInterval(() => {
      const now = Date.now();
      if (document.hidden || now - lastActivityAt > heartbeatMs * 2) {
        lastHeartbeatAt = now;
        return;
      }
      const progress = this.progressPercent();
      const deltaSeconds = Math.min(60, Math.max(0, Math.round((now - lastHeartbeatAt) / 1000)));
      lastHeartbeatAt = now;
      const progressChanged = progress >= lastProgress + 5;
      if (started && (deltaSeconds > 0 || progressChanged)) {
        this.enqueue({
          type: 'READING_PROGRESS',
          storyId: input.storyId,
          chapterId: input.chapterId,
          sessionId: input.sessionId,
          progressPercent: progress,
          activeSeconds: deltaSeconds,
        });
        lastProgress = Math.max(lastProgress, progress);
      }
      if (started && !completed && progress >= this.config.completionThresholdPercent) {
        completed = true;
        this.enqueue({
          type: 'READING_COMPLETED',
          storyId: input.storyId,
          chapterId: input.chapterId,
          sessionId: input.sessionId,
          progressPercent: progress,
        });
      }
    }, heartbeatMs);

    return () => {
      clearTimeout(startTimer);
      clearInterval(heartbeat);
      for (const [name, listener] of listeners) window.removeEventListener(name, listener);
      this.flush();
    };
  }

  flush(): void {
    if (!this.browser || this.pending.length === 0 || !this.config.enabled) return;
    this.clearFlushTimer();
    const events = this.pending.splice(0, Math.min(this.config.maxBatchSize, this.pending.length));
    const anonymousReaderId = this.anonymousReaderId();
    this.http
      .post<ApiSuccessEnvelope<unknown>>(`${this.runtime.apiBaseUrl}/reader-analytics/events`, {
        anonymousReaderId,
        events,
      })
      .pipe(
        retry({ count: 2, delay: (_error, retryCount) => timer(250 * 2 ** retryCount) }),
        catchError(() => EMPTY),
      )
      .subscribe({ complete: () => this.scheduleFlushIfNeeded() });
  }

  private enqueue(input: Omit<ReaderAnalyticsEvent, 'eventId' | 'version' | 'occurredAt'>): void {
    if (!this.browser || !this.config.enabled) return;
    this.pending.push({
      ...input,
      eventId: this.uuid(),
      version: 1,
      occurredAt: new Date().toISOString(),
    });
    if (this.pending.length >= Math.min(10, this.config.maxBatchSize)) this.flush();
    else this.scheduleFlushIfNeeded();
  }

  private loadConfig(): void {
    this.http
      .get<ApiSuccessEnvelope<ReaderAnalyticsPublicConfig>>(
        `${this.runtime.apiBaseUrl}/reader-analytics/config`,
      )
      .pipe(
        map((response) => response.data),
        catchError(() => of(DEFAULT_CONFIG)),
      )
      .subscribe((config) => (this.config = config));
  }

  private scheduleFlushIfNeeded(): void {
    if (this.pending.length === 0 || this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      this.flush();
    }, 3_000);
  }

  private clearFlushTimer(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
  }

  private progressPercent(): number {
    const root = document.documentElement;
    const denominator = Math.max(1, root.scrollHeight - window.innerHeight);
    return Math.max(0, Math.min(100, Math.round((window.scrollY / denominator) * 10_000) / 100));
  }

  private anonymousReaderId(): string {
    try {
      const existing = localStorage.getItem(ANONYMOUS_KEY);
      if (existing && /^[0-9a-f-]{36}$/iu.test(existing)) return existing;
      const value = this.uuid();
      localStorage.setItem(ANONYMOUS_KEY, value);
      return value;
    } catch {
      return this.uuid();
    }
  }

  private uuid(): string {
    return globalThis.crypto?.randomUUID?.() ?? this.fallbackUuid();
  }

  private fallbackUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/gu, (token) => {
      const random = Math.floor(Math.random() * 16);
      const value = token === 'x' ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }
}

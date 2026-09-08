import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import {
  catchError,
  map,
  Observable,
  of,
  Subject,
  Subscription,
  switchMap,
  tap,
  throwError,
} from 'rxjs';

import {
  AuthSessionLifecycleEvent,
  AuthSessionLifecycleService,
} from '../../../../core/auth/auth-session-lifecycle.service';
import { OfflineConnectivityService } from '../../../../core/offline/offline-connectivity.service';
import { OfflineDbService } from '../../../../core/offline/offline-db.service';
import type { OfflineStorageScope } from '../../../../core/offline/offline.models';
import { ChapterReaderView } from '../domain/chapter-reader.models';
import {
  ChapterReaderOfflineAdapter,
  OfflineChapterReaderResult,
  shouldTryOfflineChapter,
} from './chapter-reader-offline.adapter';
import { ChapterReaderRepository } from './chapter-reader.repository';

@Injectable()
export class ChapterReaderSourceService implements OnDestroy {
  private readonly repository = inject(ChapterReaderRepository);
  private readonly connectivity = inject(OfflineConnectivityService);
  private readonly database = inject(OfflineDbService);
  private readonly lifecycle = inject(AuthSessionLifecycleService);
  private readonly offlineReader = inject(ChapterReaderOfflineAdapter);
  private readonly invalidatedSubject = new Subject<void>();
  private readonly lifecycleSubscription: Subscription;
  private knownScope: OfflineStorageScope | null = null;
  private loadGeneration = 0;
  private readonly offlineInfoState = signal<Pick<
    OfflineChapterReaderResult,
    'packageId' | 'packageName' | 'licenseExpiresAt'
  > | null>(null);

  readonly offlineInfo = this.offlineInfoState.asReadonly();
  readonly offlineMode = computed(() => this.offlineInfoState() !== null);
  readonly invalidated$ = this.invalidatedSubject.asObservable();

  constructor() {
    this.lifecycleSubscription = this.lifecycle.changes$.subscribe((event) =>
      this.handleLifecycleEvent(event),
    );
  }

  getChapter(storySlug: string, chapterNumber: string): Observable<ChapterReaderView> {
    const generation = ++this.loadGeneration;
    this.knownScope ??= this.lifecycle.scope() ?? this.database.activeScope();
    this.connectivity.initialize();
    this.clearOfflineState();

    return this.repository.getChapter(storySlug, chapterNumber).pipe(
      map((view) => ({ view, offline: null as OfflineChapterReaderResult | null })),
      catchError((onlineError: unknown) => {
        if (!shouldTryOfflineChapter(onlineError, this.connectivity.online())) {
          return throwError(() => onlineError);
        }
        return this.offlineReader.getChapter(storySlug, chapterNumber).pipe(
          catchError(() => of(null)),
          switchMap((offline) =>
            offline
              ? of({ view: offline.view, offline })
              : throwError(
                  () =>
                    new Error('Không thể kết nối và chương này chưa có bản offline còn hiệu lực.'),
                ),
          ),
        );
      }),
      switchMap((result) => {
        if (generation === this.loadGeneration) return of(result);
        if (result.offline) this.offlineReader.discardAssets(result.offline);
        return throwError(() => new Error('Phiên đọc đã thay đổi trong lúc tải chương.'));
      }),
      tap(({ offline }) => {
        if (offline) this.offlineReader.adoptAssets(offline);
        this.knownScope ??= offline ? this.database.activeScope() : null;
        this.offlineInfoState.set(
          offline
            ? {
                packageId: offline.packageId,
                packageName: offline.packageName,
                licenseExpiresAt: offline.licenseExpiresAt,
              }
            : null,
        );
      }),
      map(({ view }) => view),
    );
  }

  ngOnDestroy(): void {
    this.lifecycleSubscription.unsubscribe();
    this.invalidatedSubject.complete();
    this.clearOfflineState();
  }

  private handleLifecycleEvent(event: AuthSessionLifecycleEvent): void {
    if (event.kind === 'access-lost') return;
    if (event.kind === 'session-established') {
      const previousScope = this.knownScope ?? this.database.activeScope();
      if (!previousScope || sameScope(previousScope, event.scope)) {
        this.knownScope = event.scope;
        return;
      }
    }

    this.loadGeneration += 1;
    this.knownScope = event.kind === 'session-established' ? event.scope : null;
    this.clearOfflineState();
    this.invalidatedSubject.next();
  }

  private clearOfflineState(): void {
    this.offlineReader.releaseAssets();
    this.offlineInfoState.set(null);
  }
}

function sameScope(left: OfflineStorageScope | null, right: OfflineStorageScope | null): boolean {
  return Boolean(
    left && right && left.userId === right.userId && left.sessionId === right.sessionId,
  );
}

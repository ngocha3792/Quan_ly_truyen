import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, Observable, of, tap } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  AuthorChapterDraftInput,
  AuthorChapterMonetization,
  AuthorChapterVersion,
  AuthorChapterVersionSummary,
  AuthorManagedChapter,
  AuthorManagedStory,
  AuthorStoryMedia,
  MonetizationPriceBand,
} from '../domain/author-story-management.models';
import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';

@Injectable()
export class AuthorChapterEditorStore {
  private readonly repository = inject(AuthorStoryManagementRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly story = signal<AuthorManagedStory | null>(null);
  readonly chapter = signal<AuthorManagedChapter | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploadingImage = signal(false);
  readonly history = signal<readonly AuthorChapterVersionSummary[]>([]);
  readonly historyTotal = signal(0);
  readonly selectedVersion = signal<AuthorChapterVersion | null>(null);
  readonly loadingHistory = signal(false);
  readonly loadingVersion = signal(false);
  readonly restoringVersion = signal<number | null>(null);
  readonly success = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly monetization = signal<AuthorChapterMonetization | null>(null);
  readonly priceBands = signal<readonly MonetizationPriceBand[]>([]);
  readonly monetizationSaving = signal(false);
  private readonly historyPageSize = 10;
  private readonly historyPage = signal(0);

  load(storyId: string, chapterId: string | null): void {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    this.history.set([]);
    this.historyTotal.set(0);
    this.selectedVersion.set(null);

    forkJoin({
      story: this.repository.getStory(storyId),
      chapter: chapterId ? this.repository.getChapter(storyId, chapterId) : of(null),
      monetization: chapterId
        ? forkJoin({
            config: this.repository.getChapterMonetization(storyId, chapterId),
            bands: this.repository.listMonetizationPriceBands(),
          }).pipe(catchError(() => of(null)))
        : of(null),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({
          story,
          chapter,
          monetization,
        }: {
          story: AuthorManagedStory;
          chapter: AuthorManagedChapter | null;
          monetization: {
            readonly config: AuthorChapterMonetization;
            readonly bands: readonly MonetizationPriceBand[];
          } | null;
        }) => {
          this.story.set(story);
          this.chapter.set(chapter);
          this.monetization.set(monetization?.config ?? null);
          this.priceBands.set(monetization?.bands ?? []);
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  updateMonetization(
    storyId: string,
    chapterId: string,
    accessType: 'FREE' | 'PAID',
    priceBandId?: string,
  ): Observable<AuthorChapterMonetization> {
    this.monetizationSaving.set(true);
    this.error.set(null);
    return this.repository
      .updateChapterMonetization(storyId, chapterId, {
        accessType,
        ...(priceBandId ? { priceBandId } : {}),
      })
      .pipe(
        tap((result) => {
          this.monetization.set(result);
          this.success.set(
            result.accessType === 'PAID'
              ? `Đã đặt giá ${result.creditPrice} Credit cho chương.`
              : 'Đã chuyển chương về miễn phí.',
          );
        }),
        finalize(() => this.monetizationSaving.set(false)),
      );
  }

  loadHistory(storyId: string, chapterId: string, page: number = 1): void {
    if (this.loadingHistory()) return;
    this.loadingHistory.set(true);
    this.error.set(null);

    this.repository
      .listChapterVersions(storyId, chapterId, page, this.historyPageSize)
      .pipe(
        finalize(() => this.loadingHistory.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.history.set(page === 1 ? result.items : [...this.history(), ...result.items]);
          this.historyTotal.set(result.total);
          this.historyPage.set(result.page);
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  loadMoreHistory(storyId: string, chapterId: string): void {
    if (this.history().length >= this.historyTotal()) return;
    this.loadHistory(storyId, chapterId, this.historyPage() + 1);
  }

  selectVersion(storyId: string, chapterId: string, version: number): void {
    if (this.loadingVersion()) return;
    this.loadingVersion.set(true);
    this.error.set(null);

    this.repository
      .getChapterVersion(storyId, chapterId, version)
      .pipe(
        finalize(() => this.loadingVersion.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => this.selectedVersion.set(result),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  restoreVersion(
    storyId: string,
    chapterId: string,
    version: number,
  ): Observable<AuthorManagedChapter> {
    this.restoringVersion.set(version);
    this.error.set(null);
    this.success.set(null);

    return this.repository.restoreChapterVersion(storyId, chapterId, version).pipe(
      tap((chapter) => {
        this.chapter.set(chapter);
        this.selectedVersion.set(null);
        this.success.set(`Đã khôi phục phiên bản ${version} thành phiên bản ${chapter.version}.`);
        this.loadHistory(storyId, chapterId);
      }),
      finalize(() => this.restoringVersion.set(null)),
    );
  }

  clearSelectedVersion(): void {
    this.selectedVersion.set(null);
  }

  save(
    storyId: string,
    chapterId: string | null,
    input: AuthorChapterDraftInput,
  ): Observable<AuthorManagedChapter> {
    this.saving.set(true);
    this.error.set(null);

    const request$ = chapterId
      ? this.repository.updateChapter(storyId, chapterId, input)
      : this.repository.createChapter(storyId, input);

    return request$.pipe(
      tap((chapter: AuthorManagedChapter) => this.chapter.set(chapter)),
      finalize(() => this.saving.set(false)),
    );
  }

  setError(error: unknown): void {
    this.error.set(getApiErrorMessage(error));
  }

  uploadImage(chapterId: string, file: File): Observable<AuthorStoryMedia> {
    this.uploadingImage.set(true);
    this.error.set(null);
    return this.repository
      .uploadChapterImage(chapterId, file)
      .pipe(finalize(() => this.uploadingImage.set(false)));
  }
}

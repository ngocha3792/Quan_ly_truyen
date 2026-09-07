import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  AuthorManagedChapter,
  AuthorManagedChapterSummary,
  AuthorManagedStory,
} from '../domain/author-story-management.models';
import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';

@Injectable()
export class AuthorChaptersStore {
  private readonly repository = inject(AuthorStoryManagementRepository);
  private readonly destroyRef = inject(DestroyRef);
  private readonly chaptersState = signal<readonly AuthorManagedChapterSummary[]>([]);

  readonly story = signal<AuthorManagedStory | null>(null);
  readonly chapters = this.chaptersState.asReadonly();
  readonly loading = signal(false);
  readonly actionChapterId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  load(storyId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    forkJoin({
      story: this.repository.getStory(storyId),
      chapters: this.repository.listChapters(storyId),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({
          story,
          chapters,
        }: {
          story: AuthorManagedStory;
          chapters: readonly AuthorManagedChapterSummary[];
        }) => {
          this.story.set(story);
          this.chaptersState.set(chapters);
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  deleteDraft(storyId: string, chapterId: string): void {
    if (this.actionChapterId()) return;

    this.actionChapterId.set(chapterId);
    this.error.set(null);
    this.success.set(null);

    this.repository
      .deleteChapter(storyId, chapterId)
      .pipe(
        finalize(() => this.actionChapterId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.chaptersState.update((chapters: readonly AuthorManagedChapterSummary[]) =>
            chapters.filter((chapter: AuthorManagedChapterSummary) => chapter.id !== chapterId),
          );
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  publish(storyId: string, chapterId: string): void {
    if (this.actionChapterId()) return;

    this.actionChapterId.set(chapterId);
    this.error.set(null);
    this.success.set(null);

    this.repository
      .publishChapter(storyId, chapterId)
      .pipe(
        finalize(() => this.actionChapterId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (published: AuthorManagedChapter) => {
          this.replaceChapter(published);
          this.success.set('Chương đã được xuất bản.');
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  schedule(storyId: string, chapterId: string, scheduledAt: string): void {
    if (this.actionChapterId()) return;

    this.actionChapterId.set(chapterId);
    this.error.set(null);
    this.success.set(null);

    this.repository
      .scheduleChapter(storyId, chapterId, scheduledAt)
      .pipe(
        finalize(() => this.actionChapterId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (scheduled: AuthorManagedChapter) => {
          this.replaceChapter(scheduled);
          this.success.set('Đã lưu lịch xuất bản chương.');
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  cancelSchedule(storyId: string, chapterId: string): void {
    if (this.actionChapterId()) return;

    this.actionChapterId.set(chapterId);
    this.error.set(null);
    this.success.set(null);

    this.repository
      .cancelChapterSchedule(storyId, chapterId)
      .pipe(
        finalize(() => this.actionChapterId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (draft: AuthorManagedChapter) => {
          this.replaceChapter(draft);
          this.success.set('Đã huỷ lịch; chương trở lại bản nháp.');
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  private replaceChapter(changed: AuthorManagedChapter): void {
    this.chaptersState.update((chapters: readonly AuthorManagedChapterSummary[]) =>
      chapters.map((chapter: AuthorManagedChapterSummary) =>
        chapter.id === changed.id ? toChapterSummary(changed) : chapter,
      ),
    );
  }
}

function toChapterSummary(chapter: AuthorManagedChapter): AuthorManagedChapterSummary {
  return {
    id: chapter.id,
    storyId: chapter.storyId,
    number: chapter.number,
    title: chapter.title,
    slug: chapter.slug,
    status: chapter.status,
    wordCount: chapter.wordCount,
    version: chapter.version,
    scheduledAt: chapter.scheduledAt,
    publishedAt: chapter.publishedAt,
    createdAt: chapter.createdAt,
    updatedAt: chapter.updatedAt,
  };
}

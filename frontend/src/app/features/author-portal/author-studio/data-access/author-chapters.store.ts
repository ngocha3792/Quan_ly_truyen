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

  load(storyId: string): void {
    this.loading.set(true);
    this.error.set(null);

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

    this.repository
      .publishChapter(storyId, chapterId)
      .pipe(
        finalize(() => this.actionChapterId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (published: AuthorManagedChapter) => {
          this.chaptersState.update((chapters: readonly AuthorManagedChapterSummary[]) =>
            chapters.map((chapter: AuthorManagedChapterSummary) =>
              chapter.id === published.id
                ? {
                    id: published.id,
                    storyId: published.storyId,
                    number: published.number,
                    title: published.title,
                    slug: published.slug,
                    status: published.status,
                    wordCount: published.wordCount,
                    version: published.version,
                    scheduledAt: published.scheduledAt,
                    publishedAt: published.publishedAt,
                    createdAt: published.createdAt,
                    updatedAt: published.updatedAt,
                  }
                : chapter,
            ),
          );
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }
}

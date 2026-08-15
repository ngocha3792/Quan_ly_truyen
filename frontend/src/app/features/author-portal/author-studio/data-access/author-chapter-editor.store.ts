import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin, Observable, of, tap } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  AuthorChapterDraftInput,
  AuthorManagedChapter,
  AuthorManagedStory,
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
  readonly error = signal<string | null>(null);

  load(storyId: string, chapterId: string | null): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      story: this.repository.getStory(storyId),
      chapter: chapterId ? this.repository.getChapter(storyId, chapterId) : of(null),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ story, chapter }: { story: AuthorManagedStory; chapter: AuthorManagedChapter | null }) => {
          this.story.set(story);
          this.chapter.set(chapter);
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
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
}

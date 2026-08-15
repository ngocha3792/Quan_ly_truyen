import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { AuthorManagedStory } from '../domain/author-story-management.models';
import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';

@Injectable()
export class AuthorStoriesStore {
  private readonly repository = inject(AuthorStoryManagementRepository);
  private readonly destroyRef = inject(DestroyRef);
  private readonly storiesState = signal<readonly AuthorManagedStory[]>([]);

  readonly stories = this.storiesState.asReadonly();
  readonly loading = signal(false);
  readonly actionStoryId = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.repository
      .listStories()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (stories: readonly AuthorManagedStory[]) => this.storiesState.set(stories),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  deleteDraft(storyId: string): void {
    if (this.actionStoryId()) return;

    this.actionStoryId.set(storyId);
    this.error.set(null);

    this.repository
      .deleteStory(storyId)
      .pipe(
        finalize(() => this.actionStoryId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.storiesState.update((stories: readonly AuthorManagedStory[]) =>
            stories.filter((story: AuthorManagedStory) => story.id !== storyId),
          );
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }
}

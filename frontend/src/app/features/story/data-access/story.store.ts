import { inject, Injectable, signal } from '@angular/core';
import { catchError, of, switchMap, tap } from 'rxjs';
import { getApiErrorMessage } from '../../../core/http/api-error.util';
import { RelatedStoryItem, Story, StoryComment } from '../domain/story.models';
import { StoryDetailRepository } from './story.repository';

@Injectable()
export class StoryDetailStore {
  private readonly repository = inject(StoryDetailRepository);

  readonly story = signal<Story | null | undefined>(undefined);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly comments = signal<readonly StoryComment[]>([]);
  readonly relatedStories = signal<readonly RelatedStoryItem[]>([]);

  loadStory(slug: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.repository.getStoryBySlug(slug).pipe(
      tap((story) => {
        this.story.set(story);
        this.loading.set(false);
      }),
      switchMap((story) => {
        if (!story) return of(null);

        this.repository.getComments(story.id).pipe(
          tap((comments) => this.comments.set(comments)),
          catchError(() => of([]))
        ).subscribe();

        this.repository.getRelatedStories(story.categories).pipe(
          tap((related) => this.relatedStories.set(related)),
          catchError(() => of([]))
        ).subscribe();

        return of(story);
      }),
      catchError((err) => {
        this.loading.set(false);
        this.error.set(getApiErrorMessage(err, 'Không thể tải thông tin truyện.'));
        return of(null);
      })
    ).subscribe();
  }
}

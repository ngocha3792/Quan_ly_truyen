import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { STORIES } from '../../../../shared/testing/story.fixtures';
import { RelatedStoryItem, Story, StoryComment } from '../domain/story.models';
import { MOCK_RELATED_STORIES, MOCK_STORY_COMMENTS } from '../mock/story.mock';
import { StoryDetailRepository } from './story.repository';

@Injectable()
export class StoryDetailMockRepository implements StoryDetailRepository {
  getStoryBySlug(slug: string): Observable<Story | null> {
    const found = STORIES.find((s) => s.slug === slug) ?? null;
    return of(found).pipe(delay(200));
  }

  getComments(_storyId: string): Observable<readonly StoryComment[]> {
    return of(MOCK_STORY_COMMENTS).pipe(delay(150));
  }

  getRelatedStories(_categories: readonly string[]): Observable<readonly RelatedStoryItem[]> {
    return of(MOCK_RELATED_STORIES).pipe(delay(180));
  }
}

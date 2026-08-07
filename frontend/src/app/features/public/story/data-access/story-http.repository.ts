import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RelatedStoryItem, Story, StoryComment } from '../domain/story.models';
import { StoryDetailRepository } from './story.repository';

@Injectable()
export class StoryDetailHttpRepository implements StoryDetailRepository {
  private readonly http = inject(HttpClient);

  getStoryBySlug(slug: string): Observable<Story | null> {
    return this.http.get<Story | null>(`/api/v1/stories/${slug}`);
  }

  getComments(storyId: string): Observable<readonly StoryComment[]> {
    return this.http.get<readonly StoryComment[]>(`/api/v1/stories/${storyId}/comments`);
  }

  getRelatedStories(categories: readonly string[]): Observable<readonly RelatedStoryItem[]> {
    return this.http.get<readonly RelatedStoryItem[]>(`/api/v1/stories/related`, {
      params: { categories: categories.join(',') },
    });
  }
}

import { Observable } from 'rxjs';
import { RelatedStoryItem, Story, StoryComment } from '../domain/story.models';

export abstract class StoryDetailRepository {
  abstract getStoryBySlug(slug: string): Observable<Story | null>;
  abstract getComments(storyId: string): Observable<readonly StoryComment[]>;
  abstract getRelatedStories(categories: readonly string[]): Observable<readonly RelatedStoryItem[]>;
}

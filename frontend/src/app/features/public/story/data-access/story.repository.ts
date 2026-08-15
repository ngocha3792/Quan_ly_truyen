import { Observable } from 'rxjs';
import { RelatedStoryItem, Story, StoryComment } from '../domain/story.models';

export abstract class StoryDetailRepository {
  abstract getStoryBySlug(slug: string): Observable<Story | null>;
  abstract getComments(storySlug: string): Observable<readonly StoryComment[]>;
  abstract getRelatedStories(categories: readonly string[]): Observable<readonly RelatedStoryItem[]>;
  abstract getMyRating(storyId: string): Observable<number | null>;
  abstract setRating(storyId: string, score: number): Observable<number>;
  abstract clearRating(storyId: string): Observable<void>;
  abstract createComment(storyId: string, body: string): Observable<StoryComment>;
  abstract updateComment(commentId: string, body: string): Observable<StoryComment>;
  abstract deleteComment(commentId: string): Observable<void>;
}

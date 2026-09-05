import { Observable } from 'rxjs';
import type {
  CommentReactionApiType,
  CommentReportReasonApi,
} from '../../../../core/http/reader-engagement-api.model';
import {
  RelatedStoryItem,
  Story,
  StoryChapterListPage,
  StoryComment,
} from '../domain/story.models';

export abstract class StoryDetailRepository {
  abstract getStoryBySlug(slug: string): Observable<Story | null>;
  abstract listChapters(
    storySlug: string,
    page: number,
    pageSize: number,
  ): Observable<StoryChapterListPage>;
  abstract getComments(storySlug: string): Observable<readonly StoryComment[]>;
  abstract getRelatedStories(
    categories: readonly string[],
  ): Observable<readonly RelatedStoryItem[]>;
  abstract getMyRating(storyId: string): Observable<number | null>;
  abstract setRating(storyId: string, score: number): Observable<number>;
  abstract clearRating(storyId: string): Observable<void>;
  abstract createComment(storyId: string, body: string): Observable<StoryComment>;
  abstract updateComment(commentId: string, body: string): Observable<StoryComment>;
  abstract deleteComment(commentId: string): Observable<void>;
  abstract getReplies(rootCommentId: string): Observable<readonly StoryComment[]>;
  abstract createReply(parentCommentId: string, body: string): Observable<StoryComment>;
  abstract setReaction(
    commentId: string,
    type: CommentReactionApiType,
  ): Observable<{
    readonly viewerReaction: CommentReactionApiType | null;
    readonly reactions: Readonly<Record<CommentReactionApiType, number>>;
  }>;
  abstract clearReaction(commentId: string): Observable<void>;
  abstract reportComment(
    commentId: string,
    reason: CommentReportReasonApi,
    description?: string,
  ): Observable<void>;
}

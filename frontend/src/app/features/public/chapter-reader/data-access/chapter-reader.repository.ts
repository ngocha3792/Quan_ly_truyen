import { Observable } from 'rxjs';
import type {
  CommentReactionApiType,
  CommentReportReasonApi,
} from '../../../../core/http/reader-engagement-api.model';
import { ChapterComment, ChapterReaderView } from '../domain/chapter-reader.models';

export abstract class ChapterReaderRepository {
  abstract getChapter(storySlug: string, chapterNumber: string): Observable<ChapterReaderView>;
  abstract getComments(
    storySlug: string,
    chapterNumber: string,
  ): Observable<{ readonly items: readonly ChapterComment[]; readonly total: number }>;
  abstract createComment(
    storyId: string,
    chapterId: string,
    body: string,
  ): Observable<ChapterComment>;
  abstract updateComment(commentId: string, body: string): Observable<ChapterComment>;
  abstract deleteComment(commentId: string): Observable<void>;
  abstract getReplies(rootCommentId: string): Observable<readonly ChapterComment[]>;
  abstract createReply(parentCommentId: string, body: string): Observable<ChapterComment>;
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
  abstract saveProgress(storyId: string, chapterId: string): Observable<void>;
}

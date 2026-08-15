import { Observable } from 'rxjs';
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
  abstract saveProgress(storyId: string, chapterId: string): Observable<void>;
}

import { Observable } from 'rxjs';

import {
  AuthorChapterDraftInput,
  AuthorManagedChapter,
  AuthorManagedChapterSummary,
  AuthorManagedStory,
  AuthorStoryDraftInput,
  AuthorStoryMedia,
  AuthorStoryMetadataCategory,
  AuthorStoryMetadataTag,
  AuthorStoryPublication,
  AuthorStoryUpdateInput,
} from './author-story-management.models';

export abstract class AuthorStoryManagementRepository {
  abstract listStories(): Observable<readonly AuthorManagedStory[]>;
  abstract getStory(storyId: string): Observable<AuthorManagedStory>;
  abstract createStory(input: AuthorStoryDraftInput): Observable<AuthorManagedStory>;
  abstract updateStory(
    storyId: string,
    input: AuthorStoryUpdateInput,
  ): Observable<AuthorManagedStory>;
  abstract deleteStory(storyId: string): Observable<void>;
  abstract listCategories(): Observable<readonly AuthorStoryMetadataCategory[]>;
  abstract listTags(): Observable<readonly AuthorStoryMetadataTag[]>;
  abstract submitStory(storyId: string, authorNote: string): Observable<AuthorStoryPublication>;
  abstract cancelSubmission(storyId: string): Observable<AuthorStoryPublication>;
  abstract listChapters(storyId: string): Observable<readonly AuthorManagedChapterSummary[]>;
  abstract getChapter(storyId: string, chapterId: string): Observable<AuthorManagedChapter>;
  abstract createChapter(
    storyId: string,
    input: AuthorChapterDraftInput,
  ): Observable<AuthorManagedChapter>;
  abstract updateChapter(
    storyId: string,
    chapterId: string,
    input: AuthorChapterDraftInput,
  ): Observable<AuthorManagedChapter>;
  abstract deleteChapter(storyId: string, chapterId: string): Observable<void>;
  abstract publishChapter(storyId: string, chapterId: string): Observable<AuthorManagedChapter>;
  abstract uploadCover(storyId: string, file: File): Observable<AuthorStoryMedia>;
  abstract getMedia(mediaId: string): Observable<AuthorStoryMedia>;
}

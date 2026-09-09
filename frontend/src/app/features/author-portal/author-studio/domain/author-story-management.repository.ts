import { Observable } from 'rxjs';
import { ChapterVersionDiff } from './chapter-editing.models';

import {
  AuthorChapterDraftInput,
  AuthorChapterVersion,
  AuthorChapterVersionPage,
  AuthorChapterMonetization,
  AuthorManagedChapter,
  AuthorManagedChapterSummary,
  AuthorManagedStory,
  AuthorStoryDraftInput,
  AuthorStoryContributor,
  AuthorStoryContributorInput,
  AuthorStoryContributorRole,
  AuthorStoryMedia,
  AuthorStoryMetadataCategory,
  AuthorStoryMetadataTag,
  MonetizationPriceBand,
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
  abstract autosaveChapter(
    storyId: string,
    chapterId: string,
    input: AuthorChapterDraftInput,
  ): Observable<AuthorManagedChapter>;
  abstract listMonetizationPriceBands(): Observable<readonly MonetizationPriceBand[]>;
  abstract getChapterMonetization(
    storyId: string,
    chapterId: string,
  ): Observable<AuthorChapterMonetization>;
  abstract updateChapterMonetization(
    storyId: string,
    chapterId: string,
    input: { readonly accessType: 'FREE' | 'PAID'; readonly priceBandId?: string },
  ): Observable<AuthorChapterMonetization>;
  abstract listChapterVersions(
    storyId: string,
    chapterId: string,
    page: number,
    pageSize: number,
    includeAutosaves?: boolean,
  ): Observable<AuthorChapterVersionPage>;
  abstract getChapterVersion(
    storyId: string,
    chapterId: string,
    version: number,
  ): Observable<AuthorChapterVersion>;
  abstract restoreChapterVersion(
    storyId: string,
    chapterId: string,
    version: number,
    expectedVersion: number,
  ): Observable<AuthorManagedChapter>;
  abstract getChapterVersionDiff(
    storyId: string,
    chapterId: string,
    from: number,
    to: number,
  ): Observable<ChapterVersionDiff>;
  abstract deleteChapter(storyId: string, chapterId: string): Observable<void>;
  abstract publishChapter(storyId: string, chapterId: string): Observable<AuthorManagedChapter>;
  abstract scheduleChapter(
    storyId: string,
    chapterId: string,
    scheduledAt: string,
  ): Observable<AuthorManagedChapter>;
  abstract cancelChapterSchedule(
    storyId: string,
    chapterId: string,
  ): Observable<AuthorManagedChapter>;
  abstract uploadCover(storyId: string, file: File): Observable<AuthorStoryMedia>;
  abstract uploadChapterImage(chapterId: string, file: File): Observable<AuthorStoryMedia>;
  abstract getMedia(mediaId: string): Observable<AuthorStoryMedia>;
  abstract listContributors(storyId: string): Observable<readonly AuthorStoryContributor[]>;
  abstract upsertContributor(
    storyId: string,
    input: AuthorStoryContributorInput,
  ): Observable<AuthorStoryContributor>;
  abstract removeContributor(
    storyId: string,
    contributorUserId: string,
    role: AuthorStoryContributorRole,
  ): Observable<void>;
}

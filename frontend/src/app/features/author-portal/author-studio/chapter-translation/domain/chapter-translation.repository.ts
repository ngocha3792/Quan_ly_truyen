import { Observable } from 'rxjs';
import { AuthorManagedChapter } from '../../domain/author-story-management.models';

import {
  AiStoryProfile,
  ChapterTranslation,
  UpdateAiStoryProfilePayload,
  TranslationReviewRequest,
} from './chapter-translation.models';

export abstract class ChapterTranslationRepository {
  abstract review(
    storyId: string,
    chapterId: string,
    language: string,
    input: TranslationReviewRequest,
  ): Observable<{ translation: ChapterTranslation; chapter: AuthorManagedChapter | null }>;
  abstract getStoryProfile(storyId: string): Observable<AiStoryProfile>;
  abstract updateStoryProfile(
    storyId: string,
    payload: UpdateAiStoryProfilePayload,
  ): Observable<AiStoryProfile>;

  abstract request(
    storyId: string,
    chapterId: string,
    targetLanguageCode: string,
    connectionId?: string,
  ): Observable<Pick<ChapterTranslation, 'id' | 'status' | 'targetLanguageCode'>>;

  abstract get(
    storyId: string,
    chapterId: string,
    targetLanguageCode: string,
  ): Observable<ChapterTranslation | null>;
}

import { Observable } from 'rxjs';

import {
  AiStoryProfile,
  ChapterTranslation,
  UpdateAiStoryProfilePayload,
} from './chapter-translation.models';

export abstract class ChapterTranslationRepository {
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

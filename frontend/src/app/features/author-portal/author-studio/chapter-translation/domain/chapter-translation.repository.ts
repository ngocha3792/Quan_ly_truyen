import { Observable } from 'rxjs';

import { ChapterTranslation } from './chapter-translation.models';

export abstract class ChapterTranslationRepository {
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

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../../core/http/api-envelope.model';
import { AuthorManagedChapter } from '../../domain/author-story-management.models';
import {
  AiStoryProfile,
  ChapterTranslation,
  UpdateAiStoryProfilePayload,
  TranslationReviewRequest,
} from '../domain/chapter-translation.models';
import { ChapterTranslationRepository } from '../domain/chapter-translation.repository';

@Injectable()
export class ChapterTranslationHttpRepository extends ChapterTranslationRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);

  getStoryProfile(storyId: string): Observable<AiStoryProfile> {
    return this.http
      .get<ApiSuccessEnvelope<AiStoryProfile>>(
        `${this.config.apiBaseUrl}/author/stories/${storyId}/ai-profile`,
      )
      .pipe(map((response) => response.data));
  }

  updateStoryProfile(
    storyId: string,
    payload: UpdateAiStoryProfilePayload,
  ): Observable<AiStoryProfile> {
    return this.http
      .patch<ApiSuccessEnvelope<AiStoryProfile>>(
        `${this.config.apiBaseUrl}/author/stories/${storyId}/ai-profile`,
        payload,
      )
      .pipe(map((response) => response.data));
  }

  request(
    storyId: string,
    chapterId: string,
    targetLanguageCode: string,
    connectionId?: string,
  ): Observable<Pick<ChapterTranslation, 'id' | 'status' | 'targetLanguageCode'>> {
    return this.http
      .post<ApiSuccessEnvelope<Pick<ChapterTranslation, 'id' | 'status' | 'targetLanguageCode'>>>(
        `${this.translationUrl(storyId, chapterId)}/${targetLanguageCode}`,
        { connectionId },
      )
      .pipe(map((response) => response.data));
  }

  get(
    storyId: string,
    chapterId: string,
    targetLanguageCode: string,
  ): Observable<ChapterTranslation | null> {
    return this.http
      .get<ApiSuccessEnvelope<ChapterTranslation | null>>(
        `${this.translationUrl(storyId, chapterId)}/${targetLanguageCode}`,
      )
      .pipe(map((response) => response.data));
  }

  private translationUrl(storyId: string, chapterId: string): string {
    return `${this.config.apiBaseUrl}/author/stories/${storyId}/chapters/${chapterId}/translations`;
  }

  review(storyId: string, chapterId: string, language: string, input: TranslationReviewRequest) {
    return this.http
      .post<
        ApiSuccessEnvelope<{
          translation: ChapterTranslation;
          chapter: AuthorManagedChapter | null;
        }>
      >(`${this.translationUrl(storyId, chapterId)}/${language}/review`, input, {
        headers: { 'x-idempotency-key': crypto.randomUUID() },
      })
      .pipe(map((response) => response.data));
  }
}

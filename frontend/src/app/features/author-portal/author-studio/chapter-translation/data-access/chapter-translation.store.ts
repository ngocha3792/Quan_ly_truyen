import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import { ChapterTranslation } from '../domain/chapter-translation.models';
import { ChapterTranslationRepository } from '../domain/chapter-translation.repository';

@Injectable()
export class ChapterTranslationStore {
  private readonly repository = inject(ChapterTranslationRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly requesting = signal(false);
  readonly translation = signal<ChapterTranslation | null>(null);
  readonly error = signal<string | null>(null);

  request(storyId: string, chapterId: string, targetLanguageCode: string): void {
    if (this.requesting()) return;

    this.requesting.set(true);
    this.error.set(null);

    this.repository
      .request(storyId, chapterId, targetLanguageCode)
      .pipe(
        finalize(() => this.requesting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) =>
          this.translation.set({
            id: result.id,
            targetLanguageCode: result.targetLanguageCode,
            status: result.status,
            translatedTitle: null,
            translatedContent: null,
            errorCode: null,
            errorMessage: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  refresh(storyId: string, chapterId: string, targetLanguageCode: string): void {
    if (this.requesting()) return;

    this.requesting.set(true);
    this.error.set(null);

    this.repository
      .get(storyId, chapterId, targetLanguageCode)
      .pipe(
        finalize(() => this.requesting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => this.translation.set(result),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  clearError(): void {
    this.error.set(null);
  }
}

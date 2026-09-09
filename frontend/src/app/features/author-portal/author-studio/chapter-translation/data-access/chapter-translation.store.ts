import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import { ChapterTranslation } from '../domain/chapter-translation.models';
import { ChapterTranslationRepository } from '../domain/chapter-translation.repository';

@Injectable()
export class ChapterTranslationStore {
  private readonly repository = inject(ChapterTranslationRepository);
  private readonly destroyRef = inject(DestroyRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  readonly requesting = signal(false);
  readonly translation = signal<ChapterTranslation | null>(null);
  readonly error = signal<string | null>(null);
  constructor() {
    this.destroyRef.onDestroy(() => this.stop());
  }

  request(storyId: string, chapterId: string, language: string): void {
    if (this.requesting()) return;
    this.stop();
    this.requesting.set(true);
    this.error.set(null);
    this.translation.set(null);
    this.repository
      .request(storyId, chapterId, language)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.requesting.set(false);
          this.refresh(storyId, chapterId, language);
        },
        error: (error: unknown) => {
          this.requesting.set(false);
          this.error.set(getApiErrorMessage(error));
        },
      });
  }
  refresh(storyId: string, chapterId: string, language: string): void {
    this.stop();
    const generation = ++this.generation;
    this.requesting.set(true);
    this.error.set(null);
    if (this.translation()?.targetLanguageCode !== language) this.translation.set(null);
    this.repository
      .get(storyId, chapterId, language)
      .pipe(
        finalize(() => {
          if (generation === this.generation) this.requesting.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          if (generation !== this.generation) return;
          this.translation.set(result);
          if (this.browser && (result?.status === 'PENDING' || result?.status === 'PROCESSING'))
            this.timer = setTimeout(() => this.refresh(storyId, chapterId, language), 3000);
        },
        error: (error: unknown) => {
          if (generation === this.generation) this.error.set(getApiErrorMessage(error));
        },
      });
  }
  clearError(): void {
    this.error.set(null);
  }
  private stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import { AiStoryProfile, UpdateAiStoryProfilePayload } from '../domain/chapter-translation.models';
import { ChapterTranslationRepository } from '../domain/chapter-translation.repository';

@Injectable()
export class AiStoryProfileStore {
  private readonly repository = inject(ChapterTranslationRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = signal<AiStoryProfile | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  load(storyId: string): void {
    this.saving.set(true);
    this.error.set(null);
    this.repository
      .getStoryProfile(storyId)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (profile) => this.profile.set(profile),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  update(storyId: string, payload: UpdateAiStoryProfilePayload): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.repository
      .updateStoryProfile(storyId, payload)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (profile) => this.profile.set(profile),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  clearError(): void {
    this.error.set(null);
  }
}

import { inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, of, take, tap } from 'rxjs';

import { PublicStoriesApiClient } from '../../../../../core/http/public-stories-api.client';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';

@Injectable({ providedIn: 'root' })
export class RecommendationPreferencesStore {
  private readonly api = inject(PublicStoriesApiClient);

  private readonly enabledState = signal(true);
  private readonly loadingState = signal(false);
  private readonly savingState = signal(false);
  private readonly loadedState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly enabled = this.enabledState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  readonly error = this.errorState.asReadonly();

  load(): void {
    if (this.loading() || this.loaded()) return;

    this.loadingState.set(true);
    this.errorState.set(null);
    this.api
      .recommendationPreferences()
      .pipe(
        take(1),
        tap((value) => {
          this.enabledState.set(value.personalizationEnabled);
          this.loadedState.set(true);
        }),
        catchError((error) => {
          // Keep the safe default (enabled) when an older API has no endpoint.
          this.errorState.set(getApiErrorMessage(error));
          return of(null);
        }),
        finalize(() => this.loadingState.set(false)),
      )
      .subscribe();
  }

  update(personalizationEnabled: boolean): void {
    if (this.saving()) return;

    const previous = this.enabled();
    this.enabledState.set(personalizationEnabled);
    this.savingState.set(true);
    this.errorState.set(null);

    this.api
      .updateRecommendationPreferences({ personalizationEnabled })
      .pipe(
        take(1),
        tap((value) => this.enabledState.set(value.personalizationEnabled)),
        catchError((error) => {
          this.enabledState.set(previous);
          this.errorState.set(getApiErrorMessage(error));
          return of(null);
        }),
        finalize(() => this.savingState.set(false)),
      )
      .subscribe();
  }
}

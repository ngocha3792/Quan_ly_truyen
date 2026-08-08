import { inject, Injectable, signal } from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { catchError, concatMap, EMPTY, Subject, takeUntil, tap } from 'rxjs';

import { AuthSessionLifecycleService } from '../../../../../core/auth/auth-session-lifecycle.service';

import { getApiErrorMessage } from '../../../../../core/http/api-error.util';

import { AccountUiPreferences } from '../domain/account-profile.models';

import { AccountProfileApiService } from './account-profile-api.service';

const DEFAULT_PREFERENCES: AccountUiPreferences = {
  newChapterNotifications: true,

  showRecentActivity: true,

  allowUpdateEmails: true,
};

interface QueuedPreferenceWrite {
  readonly revision: number;

  readonly value: AccountUiPreferences;
}

@Injectable({
  providedIn: 'root',
})
export class AccountPreferencesStore {
  private readonly api = inject(AccountProfileApiService);

  private readonly lifecycle = inject(AuthSessionLifecycleService);

  private readonly preferencesState = signal<AccountUiPreferences>(DEFAULT_PREFERENCES);

  private readonly errorState = signal<string | null>(null);

  private readonly writeQueue = new Subject<QueuedPreferenceWrite>();

  readonly preferences = this.preferencesState.asReadonly();

  readonly error = this.errorState.asReadonly();

  constructor() {
    this.lifecycle.changes$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.resetSessionState();
    });

    this.writeQueue
      .pipe(
        concatMap(
          ({
            revision,

            value,
          }) => {
            /*
             * Preference được queue dưới session cũ
             * tuyệt đối không được chạy dưới session mới.
             */
            if (revision !== this.lifecycle.revision()) {
              return EMPTY;
            }

            return this.api.updatePreferences(value).pipe(
              takeUntil(this.lifecycle.changes$),

              tap((serverValue) => {
                if (revision !== this.lifecycle.revision()) {
                  return;
                }

                this.preferencesState.set(serverValue);
              }),

              catchError((error) => {
                /*
                 * Nếu session đã đổi thì error này
                 * không còn liên quan tới current user.
                 */
                if (revision !== this.lifecycle.revision()) {
                  return EMPTY;
                }

                this.errorState.set(getApiErrorMessage(error));

                return this.api.getPreferences().pipe(
                  takeUntil(this.lifecycle.changes$),

                  tap((serverValue) => {
                    if (revision === this.lifecycle.revision()) {
                      this.preferencesState.set(serverValue);
                    }
                  }),

                  catchError(() => EMPTY),
                );
              }),
            );
          },
        ),

        takeUntilDestroyed(),
      )
      .subscribe();
  }

  load(): void {
    const revision = this.lifecycle.revision();

    this.api
      .getPreferences()
      .pipe(
        takeUntil(this.lifecycle.changes$),

        tap((value) => {
          if (revision !== this.lifecycle.revision()) {
            return;
          }

          this.preferencesState.set(value);
        }),

        catchError((error) => {
          if (revision === this.lifecycle.revision()) {
            this.errorState.set(getApiErrorMessage(error));
          }

          return EMPTY;
        }),
      )
      .subscribe();
  }

  update(changes: Partial<AccountUiPreferences>): void {
    const next = {
      ...this.preferencesState(),

      ...changes,
    };

    this.preferencesState.set(next);

    this.errorState.set(null);

    this.writeQueue.next({
      revision: this.lifecycle.revision(),

      value: next,
    });
  }

  reset(): void {
    /*
     * Đây vẫn là user action:
     * reset preference trên SERVER.
     */
    this.update(DEFAULT_PREFERENCES);
  }

  private resetSessionState(): void {
    /*
     * Khác reset():
     * chỉ reset LOCAL STATE,
     * tuyệt đối không gọi API.
     */
    this.preferencesState.set(DEFAULT_PREFERENCES);

    this.errorState.set(null);
  }
}

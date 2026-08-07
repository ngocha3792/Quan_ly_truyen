import {
  inject,
  Injectable,
  signal,
} from '@angular/core';

import {
  catchError,
  concatMap,
  EMPTY,
  finalize,
  Subject,
  tap,
} from 'rxjs';

import {
  getApiErrorMessage,
} from '../../../../../core/http/api-error.util';

import {
  AccountUiPreferences,
} from '../domain/account-profile.models';

import {
  AccountProfileApiService,
} from './account-profile-api.service';

const DEFAULT_PREFERENCES:
  AccountUiPreferences = {
  newChapterNotifications:
    true,

  showRecentActivity:
    true,

  allowUpdateEmails:
    true,
};

@Injectable({
  providedIn: 'root',
})
export class AccountPreferencesStore {
  private readonly api =
    inject(
      AccountProfileApiService,
    );

  private readonly preferencesState =
    signal<AccountUiPreferences>(
      DEFAULT_PREFERENCES,
    );

  private readonly errorState =
    signal<string | null>(
      null,
    );

  private readonly writeQueue =
    new Subject<AccountUiPreferences>();

  readonly preferences =
    this.preferencesState.asReadonly();

  readonly error =
    this.errorState.asReadonly();

  constructor() {
    this.writeQueue
      .pipe(
        concatMap(
          value =>
            this.api
              .updatePreferences(
                value,
              )
              .pipe(
                tap(
                  serverValue => {
                    this.preferencesState.set(
                      serverValue,
                    );
                  },
                ),

                catchError(
                  error => {
                    this.errorState.set(
                      getApiErrorMessage(
                        error,
                      ),
                    );

                    return this.api
                      .getPreferences()
                      .pipe(
                        tap(
                          serverValue => {
                            this.preferencesState.set(
                              serverValue,
                            );
                          },
                        ),

                        catchError(
                          () =>
                            EMPTY,
                        ),
                      );
                  },
                ),
              ),
        ),
      )
      .subscribe();
  }

  load(): void {
    this.api
      .getPreferences()
      .pipe(
        tap(
          value => {
            this.preferencesState.set(
              value,
            );
          },
        ),

        catchError(
          error => {
            this.errorState.set(
              getApiErrorMessage(
                error,
              ),
            );

            return EMPTY;
          },
        ),
      )
      .subscribe();
  }

  update(
    changes:
      Partial<AccountUiPreferences>,
  ): void {
    const next = {
      ...this.preferencesState(),

      ...changes,
    };

    this.preferencesState.set(
      next,
    );

    this.errorState.set(
      null,
    );

    this.writeQueue.next(
      next,
    );
  }

  reset(): void {
    this.update(
      DEFAULT_PREFERENCES,
    );
  }
}
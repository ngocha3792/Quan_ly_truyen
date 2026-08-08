import { HttpErrorResponse } from '@angular/common/http';

import { inject, Injectable } from '@angular/core';

import { catchError, finalize, map, Observable, shareReplay, tap, throwError } from 'rxjs';

import { AuthApiService } from './auth-api.service';

import { AuthRefreshCoordinatorService } from './auth-refresh-coordinator.service';

import { AuthSessionLifecycleService } from './auth-session-lifecycle.service';

import { TokenStore } from './token.store';

@Injectable({
  providedIn: 'root',
})
export class AuthRefreshService {
  private readonly api = inject(AuthApiService);

  private readonly tokenStore = inject(TokenStore);

  private readonly coordinator = inject(AuthRefreshCoordinatorService);

  private readonly lifecycle = inject(AuthSessionLifecycleService);

  /**
   * Single-flight trong cùng tab.
   *
   * Nếu 5 request cùng nhận 401:
   *
   * request 1 → tạo refresh$
   * request 2..5 → dùng lại chính refresh$
   */
  private refreshInFlight$: Observable<string> | null = null;

  refreshAccessToken(): Observable<string> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    const refresh$ = this.coordinator
      .runExclusive(() => this.api.refresh())
      .pipe(
        tap((response) => {
          this.tokenStore.set(response.accessToken);
        }),

        map((response) => response.accessToken),

        catchError((error: unknown) => {
          /*
           * Access token hiện tại vừa bị backend
           * từ chối nên không giữ nó lại.
           */
          this.tokenStore.clear();

          if (isRejectedRefreshSession(error)) {
            /*
             * 401 / 403 từ refresh endpoint:
             * refresh session thật sự không còn hợp lệ.
             */
            this.lifecycle.invalidateSession(
              'refresh-session-rejected',

              true,
            );
          } else {
            /*
             * Network / 5xx:
             * không được coi refresh cookie đã chết.
             */
            this.lifecycle.loseAccess('refresh-temporarily-unavailable');
          }

          return throwError(() => error);
        }),

        finalize(() => {
          this.refreshInFlight$ = null;
        }),

        /*
         * Phải share response/error cho toàn bộ caller
         * đang chờ cùng một refresh.
         */
        shareReplay({
          bufferSize: 1,

          refCount: false,
        }),
      );

    /*
     * Set field TRƯỚC khi caller subscribe.
     *
     * Caller tiếp theo luôn nhìn thấy cùng Observable.
     */
    this.refreshInFlight$ = refresh$;

    return refresh$;
  }
}

function isRejectedRefreshSession(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
}

import { inject, Injectable } from '@angular/core';

import { catchError, finalize, map, Observable, shareReplay, tap, throwError } from 'rxjs';

import { AuthApiService } from './auth-api.service';

import { AuthRefreshCoordinatorService } from './auth-refresh-coordinator.service';

import { AuthSessionLifecycleService } from './auth-session-lifecycle.service';

import { isTerminalRefreshSessionError } from './auth-session-error.util';

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
   * request 1 -> tạo refresh$
   * request 2..5 -> dùng lại chính refresh$
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
           * từ chối hoặc quá cũ.
           *
           * Không giữ token này lại.
           */
          this.tokenStore.clear();

          if (isTerminalRefreshSessionError(error)) {
            /*
             * Chỉ các stable error code:
             *
             * AUTH_INVALID_REFRESH_TOKEN
             * AUTH_REFRESH_TOKEN_REUSE_DETECTED
             *
             * mới chứng minh refresh session
             * thật sự chết.
             */
            this.lifecycle.invalidateSession(
              'refresh-session-rejected',

              true,
            );
          } else {
            /*
             * Bao gồm:
             *
             * AUTH_CSRF_TOKEN_*
             * AUTH_CSRF_ORIGIN_REJECTED
             * network
             * 5xx
             * unknown contract error
             *
             * Không được suy luận refresh cookie
             * đã chết.
             */
            this.lifecycle.loseAccess('refresh-temporarily-unavailable');
          }

          return throwError(() => error);
        }),

        finalize(() => {
          this.refreshInFlight$ = null;
        }),

        /**
         * Phải share response/error cho toàn bộ caller
         * đang chờ cùng một refresh.
         */
        shareReplay({
          bufferSize: 1,

          refCount: false,
        }),
      );

    /*
     * Set field trước khi caller subscribe.
     */
    this.refreshInFlight$ = refresh$;

    return refresh$;
  }
}

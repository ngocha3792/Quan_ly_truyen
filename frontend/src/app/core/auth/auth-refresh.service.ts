import { inject, Injectable } from '@angular/core';
import {
  catchError,
  finalize,
  map,
  Observable,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';

import { AuthApiService } from './auth-api.service';
import { TokenStore } from './token.store';

@Injectable({ providedIn: 'root' })
export class AuthRefreshService {
  private readonly api = inject(AuthApiService);
  private readonly tokenStore = inject(TokenStore);

  /**
   * Refresh request đang chạy.
   *
   * Mọi caller gọi refreshAccessToken() trong lúc refresh đang chạy
   * sẽ dùng chung Observable này thay vì tạo request /auth/refresh mới.
   */
  private refreshInFlight$: Observable<string> | null = null;

  refreshAccessToken(): Observable<string> {
    /**
     * Đã có một refresh request đang chạy.
     *
     * Quan trọng:
     * Không được gọi API refresh lần nữa vì backend sử dụng
     * refresh-token rotation + reuse detection.
     */
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    const refresh$ = this.api.refresh().pipe(
      map((response) => response.accessToken),

      tap((accessToken) => {
        /**
         * Cập nhật token trước khi emit cho các request đang chờ.
         *
         * Nhờ vậy các request 401 đến trễ cũng có thể nhận biết rằng
         * token đã được refresh bởi request khác.
         */
        this.tokenStore.set(accessToken);
      }),

      catchError((error: unknown) => {
        /**
         * Refresh token không còn sử dụng được.
         *
         * Không giữ access token cũ vì nó đã bị backend từ chối.
         */
        this.tokenStore.clear();

        return throwError(() => error);
      }),

      finalize(() => {
        /**
         * Refresh đã success hoặc error.
         *
         * Cho phép lần refresh tiếp theo được tạo khi access token
         * hết hạn trong tương lai.
         */
        this.refreshInFlight$ = null;
      }),

      /**
       * Single-flight.
       *
       * bufferSize: 1
       *   Caller đến sau vẫn nhận access token vừa refresh.
       *
       * refCount: false
       *   Nếu một component unsubscribe giữa lúc refresh đang chạy,
       *   HTTP refresh vẫn tiếp tục.
       *
       * Điều này đặc biệt quan trọng với refresh-token rotation:
       * không nên cancel request sau khi backend có khả năng đã bắt đầu
       * rotate refresh token.
       */
      shareReplay({
        bufferSize: 1,
        refCount: false,
      }),
    );

    this.refreshInFlight$ = refresh$;

    return refresh$;
  }
}
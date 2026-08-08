import { Injectable } from '@angular/core';

import { defer, firstValueFrom, from, Observable } from 'rxjs';

const AUTH_REFRESH_LOCK_NAME = 'truyenhub.auth.refresh-token-rotation';

@Injectable({
  providedIn: 'root',
})
export class AuthRefreshCoordinatorService {
  runExclusive<T>(operation: () => Observable<T>): Observable<T> {
    /*
     * Không có Web Locks:
     *
     * Quan trọng là giữ Observable hoàn toàn synchronous
     * về mặt subscription.
     *
     * HttpClient request sẽ được tạo ngay khi subscribe,
     * giống behavior trước Stage 2.
     */
    if (typeof navigator === 'undefined' || !navigator.locks) {
      return defer(operation);
    }

    /*
     * Khi browser hỗ trợ Web Locks:
     *
     * lock phải được giữ cho tới khi HTTP refresh
     * complete/error, nên chỉ nhánh này mới cần
     * chuyển Observable -> Promise.
     *
     * Tab khác cùng origin sẽ đợi refresh rotation
     * hiện tại hoàn tất.
     */
    return defer(() =>
      from(
        navigator.locks.request(
          AUTH_REFRESH_LOCK_NAME,

          {
            mode: 'exclusive',
          },

          () => firstValueFrom(operation()),
        ),
      ),
    );
  }
}

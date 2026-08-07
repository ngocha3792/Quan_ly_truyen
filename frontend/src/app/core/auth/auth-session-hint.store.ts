import { Injectable } from '@angular/core';

const SESSION_HINT_KEY = 'truyenhub.auth.has-refresh-session';
const CSRF_COOKIE_NAME = 'csrf_token';

/**
 * Chỉ là dấu hiệu để frontend biết có nên gọi refresh hay không.
 *
 * Không sử dụng giá trị này để xác thực người dùng.
 * Backend, refresh cookie và access token vẫn là nguồn xác thực chính.
 */
@Injectable({ providedIn: 'root' })
export class AuthSessionHintStore {
  shouldAttemptRefresh(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const storedHint = window.localStorage.getItem(SESSION_HINT_KEY);

    if (storedHint !== null) {
      return storedHint === 'true';
    }

    /**
     * csrf_token là cookie frontend có thể đọc.
     * Nó thường được backend tạo cùng refresh_token HttpOnly.
     *
     * Trường hợp localStorage chưa có hint nhưng csrf_token tồn tại,
     * frontend vẫn thử khôi phục phiên.
     */
    return readCookie(CSRF_COOKIE_NAME) !== null;
  }

  markSessionPresent(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(SESSION_HINT_KEY, 'true');
  }

  markSessionAbsent(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(SESSION_HINT_KEY, 'false');
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const prefix = `${encodeURIComponent(name)}=`;

  const entry = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));

  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

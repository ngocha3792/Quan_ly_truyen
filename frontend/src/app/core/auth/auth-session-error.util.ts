import { getApiErrorCode } from '../http/api-error.util';

/**
 * Stable auth error codes mà frontend cần hiểu
 * để quyết định lifecycle của session.
 *
 * Không map theo 401/403 vì cùng HTTP status
 * có thể mang semantics hoàn toàn khác nhau.
 */
export const AUTH_SESSION_ERROR_CODE = {
  INVALID_REFRESH_TOKEN: 'AUTH_INVALID_REFRESH_TOKEN',

  REFRESH_TOKEN_REUSE_DETECTED: 'AUTH_REFRESH_TOKEN_REUSE_DETECTED',

  CURRENT_USER_UNAVAILABLE: 'AUTH_CURRENT_USER_UNAVAILABLE',

  ACCESS_TOKEN_BLACKLISTED: 'AUTH_ACCESS_TOKEN_BLACKLISTED',

  INVALID_TOKEN: 'INVALID_TOKEN',

  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',

  CSRF_TOKEN_REQUIRED: 'AUTH_CSRF_TOKEN_REQUIRED',

  CSRF_TOKEN_MALFORMED: 'AUTH_CSRF_TOKEN_MALFORMED',

  CSRF_TOKEN_MISMATCH: 'AUTH_CSRF_TOKEN_MISMATCH',

  CSRF_TOKEN_EXPIRED: 'AUTH_CSRF_TOKEN_EXPIRED',

  CSRF_TOKEN_INVALID: 'AUTH_CSRF_TOKEN_INVALID',

  CSRF_ORIGIN_REJECTED: 'AUTH_CSRF_ORIGIN_REJECTED',
} as const;

/**
 * Các lỗi chứng minh refresh credential/session
 * thực sự không còn dùng được.
 *
 * Chỉ hai code này mới được phép khiến
 * AuthRefreshService invalidate refresh session.
 */
const TERMINAL_REFRESH_SESSION_ERROR_CODES = new Set<string>([
  AUTH_SESSION_ERROR_CODE.INVALID_REFRESH_TOKEN,

  AUTH_SESSION_ERROR_CODE.REFRESH_TOKEN_REUSE_DETECTED,
]);

/**
 * AuthStore còn xử lý cả lỗi từ /auth/me
 * sau khi refresh thành công.
 *
 * Vì vậy ngoài refresh-token errors,
 * một số access/session errors cũng chứng minh
 * current authenticated session không còn hợp lệ.
 */
const TERMINAL_AUTH_SESSION_ERROR_CODES = new Set<string>([
  ...TERMINAL_REFRESH_SESSION_ERROR_CODES,

  AUTH_SESSION_ERROR_CODE.CURRENT_USER_UNAVAILABLE,

  AUTH_SESSION_ERROR_CODE.ACCESS_TOKEN_BLACKLISTED,

  AUTH_SESSION_ERROR_CODE.INVALID_TOKEN,

  AUTH_SESSION_ERROR_CODE.TOKEN_EXPIRED,

  AUTH_SESSION_ERROR_CODE.AUTHENTICATION_REQUIRED,
]);

/**
 * Đây là security-policy failures.
 *
 * Chúng KHÔNG chứng minh refresh HttpOnly cookie
 * đã expire/revoke.
 */
const REFRESH_SECURITY_ERROR_CODES = new Set<string>([
  AUTH_SESSION_ERROR_CODE.CSRF_TOKEN_REQUIRED,

  AUTH_SESSION_ERROR_CODE.CSRF_TOKEN_MALFORMED,

  AUTH_SESSION_ERROR_CODE.CSRF_TOKEN_MISMATCH,

  AUTH_SESSION_ERROR_CODE.CSRF_TOKEN_EXPIRED,

  AUTH_SESSION_ERROR_CODE.CSRF_TOKEN_INVALID,

  AUTH_SESSION_ERROR_CODE.CSRF_ORIGIN_REJECTED,
]);

export function isTerminalRefreshSessionError(error: unknown): boolean {
  const code = getApiErrorCode(error);

  return code !== null && TERMINAL_REFRESH_SESSION_ERROR_CODES.has(code);
}

export function isTerminalAuthSessionError(error: unknown): boolean {
  const code = getApiErrorCode(error);

  return code !== null && TERMINAL_AUTH_SESSION_ERROR_CODES.has(code);
}

export function isRefreshSecurityError(error: unknown): boolean {
  const code = getApiErrorCode(error);

  return code !== null && REFRESH_SECURITY_ERROR_CODES.has(code);
}

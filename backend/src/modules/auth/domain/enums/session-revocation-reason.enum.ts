export enum SessionRevocationReason {
  USER_LOGOUT = 'user_logout',

  USER_LOGOUT_ALL = 'user_logout_all',

  USER_REVOKED_SESSION = 'user_revoked_session',

  PASSWORD_RESET = 'password_reset',

  PASSWORD_CHANGED = 'password_changed',

  EMAIL_CHANGED = 'email_changed',

  REFRESH_TOKEN_REUSE_DETECTED = 'refresh_token_reuse_detected',
  SESSION_LIMIT_EXCEEDED = 'session_limit_exceeded',
}

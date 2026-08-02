export enum SessionRevocationReason {
  USER_LOGOUT = 'user_logout',

  USER_LOGOUT_ALL = 'user_logout_all',

  USER_REVOKED_SESSION = 'user_revoked_session',

  PASSWORD_RESET = 'password_reset',

  REFRESH_TOKEN_REUSE_DETECTED = 'refresh_token_reuse_detected',
}

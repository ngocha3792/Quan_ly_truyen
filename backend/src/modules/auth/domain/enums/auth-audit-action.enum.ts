export enum AuthAuditAction {
  LOGIN_SUCCEEDED = 'auth.login.succeeded',

  SESSION_LIMIT_ENFORCED = 'auth.session.limit_enforced',

  SESSION_REVOKED = 'auth.session.revoked',

  LOGOUT = 'auth.logout',

  LOGOUT_ALL = 'auth.logout_all',

  REFRESH_TOKEN_REUSE_DETECTED = 'auth.refresh_token.reuse_detected',

  PASSWORD_RESET = 'auth.password.reset',

  PASSWORD_CHANGED = 'auth.password.changed',

  EMAIL_CHANGE_REQUESTED = 'auth.email_change.requested',

  EMAIL_CHANGED = 'auth.email_change.confirmed',
}

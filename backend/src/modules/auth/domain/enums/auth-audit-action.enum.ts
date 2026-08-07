export enum AuthAuditAction {
  PROFILE_UPDATED = 'auth.profile.updated',

  ACCOUNT_DELETED = 'auth.account.deleted',

  LOGIN_SUCCEEDED = 'auth.login.succeeded',

  MFA_ENROLLED = 'auth.mfa.enrolled',

  OAUTH_ACCOUNT_LINKED = 'auth.oauth.account_linked',

  OAUTH_ACCOUNT_CREATED = 'auth.oauth.account_created',

  SESSION_LIMIT_ENFORCED = 'auth.session.limit_enforced',

  SESSION_REVOKED = 'auth.session.revoked',

  LOGOUT = 'auth.logout',

  LOGOUT_ALL = 'auth.logout_all',

  REFRESH_TOKEN_REUSE_DETECTED = 'auth.refresh_token.reuse_detected',

  PASSWORD_RESET = 'auth.password.reset',

  PASSWORD_CHANGED = 'auth.password.changed',

  EMAIL_CHANGE_REQUESTED = 'auth.email_change.requested',

  EMAIL_CHANGED = 'auth.email_change.confirmed',
  MFA_DISABLED = 'auth.mfa.disabled',

  MFA_RECOVERY_CODES_REGENERATED = 'auth.mfa.recovery_codes_regenerated',
  RECOVERY_EMAIL_REQUESTED = 'auth.recovery_email.requested',

  RECOVERY_EMAIL_VERIFIED = 'auth.recovery_email.verified',

  RECOVERY_EMAIL_RESENT = 'auth.recovery_email.resent',

  RECOVERY_EMAIL_REMOVED = 'auth.recovery_email.removed',
  SECURITY_QUESTIONS_UPDATED = 'auth.security_questions.updated',

  SECURITY_QUESTIONS_REMOVED = 'auth.security_questions.removed',
}

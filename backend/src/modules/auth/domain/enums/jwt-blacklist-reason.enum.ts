export enum JwtBlacklistReason {
  USER_REVOKED_CURRENT_ACCESS_TOKEN = 'user_revoked_current_access_token',

  ADMIN_REVOKED_ACCESS_TOKEN = 'admin_revoked_access_token',

  SECURITY_EVENT = 'security_event',
}

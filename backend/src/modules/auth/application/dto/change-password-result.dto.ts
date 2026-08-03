export interface ChangePasswordResultDto {
  passwordChanged: true;

  otherSessionsRevoked: number;

  /**
   * Session hiện tại vẫn giữ refresh token.
   */
  currentSessionKept: true;

  /**
   * Access token đang dùng đã mất hiệu lực
   * do accessTokenVersion được tăng.
   */
  accessTokenInvalidated: true;

  /**
   * Frontend phải gọi /auth/refresh ngay.
   */
  refreshRequired: true;

  changedAt: Date;
}

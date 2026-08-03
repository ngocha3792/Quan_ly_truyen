export interface ChangePasswordResponse {
  passwordChanged: true;

  otherSessionsRevoked: number;

  currentSessionKept: true;

  accessTokenInvalidated: true;

  refreshRequired: true;

  changedAt: string;
}

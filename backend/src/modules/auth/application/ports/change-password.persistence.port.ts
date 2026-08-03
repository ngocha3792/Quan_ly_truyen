export const CHANGE_PASSWORD_PERSISTENCE_PORT = Symbol(
  'AUTH_CHANGE_PASSWORD_PERSISTENCE_PORT',
);

export interface PasswordChangeCredentialRecord {
  passwordHash: string | null;
}

export interface ChangePasswordPersistenceInput {
  userId: string;

  currentSessionId: string;

  /**
   * Dùng compare-and-swap để tránh hai request
   * đổi mật khẩu đồng thời ghi đè lên nhau.
   */
  expectedPasswordHash: string;

  nextPasswordHash: string;

  changedAt: Date;
}

export interface ChangePasswordSuccess {
  status: 'changed';

  otherSessionsRevoked: number;

  changedAt: Date;
}

export interface ChangePasswordConflict {
  status: 'conflict';
}

export interface ChangePasswordCurrentSessionUnavailable {
  status: 'current_session_unavailable';
}

export type ChangePasswordPersistenceResult =
  | ChangePasswordSuccess
  | ChangePasswordConflict
  | ChangePasswordCurrentSessionUnavailable;

export interface ChangePasswordPersistencePort {
  findCredentialByUserId(
    userId: string,
  ): Promise<PasswordChangeCredentialRecord | null>;

  changePassword(
    input: ChangePasswordPersistenceInput,
  ): Promise<ChangePasswordPersistenceResult>;
}

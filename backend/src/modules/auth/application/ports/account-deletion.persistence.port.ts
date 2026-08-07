export const ACCOUNT_DELETION_PERSISTENCE_PORT = Symbol(
  'AUTH_ACCOUNT_DELETION_PERSISTENCE_PORT',
);

export interface AccountDeletionCredentialRecord {
  passwordHash: string | null;
}

export interface DeleteAccountPersistenceInput {
  userId: string;

  currentSessionId: string;

  /*
   * Compare-and-swap.
   *
   * Nếu password bị đổi giữa lúc verify
   * và transaction delete thì request
   * phải fail thay vì xóa nhầm state mới.
   */
  expectedPasswordHash: string;

  deletedAt: Date;

  requestIp?: string;

  requestUserAgent?: string;
}

export interface DeleteAccountSuccess {
  status: 'deleted';

  sessionsRevoked: number;

  deletedAt: Date;
}

export interface DeleteAccountConflict {
  status: 'conflict';
}

export interface DeleteAccountCurrentSessionUnavailable {
  status: 'current_session_unavailable';
}

export type DeleteAccountPersistenceResult =
  | DeleteAccountSuccess
  | DeleteAccountConflict
  | DeleteAccountCurrentSessionUnavailable;

export interface AccountDeletionPersistencePort {
  findCredentialByUserId(
    userId: string,
  ): Promise<AccountDeletionCredentialRecord | null>;

  deleteAccount(
    input: DeleteAccountPersistenceInput,
  ): Promise<DeleteAccountPersistenceResult>;
}

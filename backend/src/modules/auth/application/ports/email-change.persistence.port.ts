export const EMAIL_CHANGE_PERSISTENCE_PORT = Symbol(
  'AUTH_EMAIL_CHANGE_PERSISTENCE_PORT',
);

export interface EmailChangeCredentialRecord {
  email: string;

  passwordHash: string | null;
}

export interface RequestEmailChangeInput {
  userId: string;

  expectedCurrentEmail: string;

  expectedPasswordHash: string;

  newEmail: string;

  rawToken: string;

  tokenHash: string;

  requestedAt: Date;

  expiresAt: Date;

  expiresInMinutes: number;
}

export type RequestEmailChangePersistenceResult =
  | {
      status: 'requested';

      currentEmail: string;

      newEmail: string;

      expiresAt: Date;
    }
  | {
      status: 'email_in_use';

      email: string;
    }
  | {
      status: 'same_email';
    }
  | {
      status: 'conflict';
    }
  | {
      status: 'account_unavailable';
    };

export interface ConfirmEmailChangeInput {
  tokenHash: string;

  confirmedAt: Date;
}

export interface EmailChangeSuccess {
  previousEmail: string;

  email: string;

  changedAt: Date;

  sessionsRevoked: number;
}

export type ConfirmEmailChangePersistenceResult =
  | ({
      status: 'changed';
    } & EmailChangeSuccess)
  | ({
      status: 'already_changed';
    } & EmailChangeSuccess)
  | {
      status: 'email_in_use';

      email: string;
    }
  | {
      status: 'expired';

      expiresAt: Date;
    }
  | {
      status: 'invalid';
    };

export interface EmailChangePersistencePort {
  findCredentialByUserId(
    userId: string,
  ): Promise<EmailChangeCredentialRecord | null>;

  request(
    input: RequestEmailChangeInput,
  ): Promise<RequestEmailChangePersistenceResult>;

  confirm(
    input: ConfirmEmailChangeInput,
  ): Promise<ConfirmEmailChangePersistenceResult>;
}

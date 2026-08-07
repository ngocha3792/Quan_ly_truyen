export const RECOVERY_EMAIL_PERSISTENCE_PORT = Symbol(
  'AUTH_RECOVERY_EMAIL_PERSISTENCE_PORT',
);

export interface RecoveryEmailCredentialRecord {
  primaryEmail: string;

  passwordHash: string | null;
}

export interface RecoveryEmailStatusRecord {
  email: string | null;

  verifiedAt: Date | null;

  pendingEmail: string | null;

  pendingExpiresAt: Date | null;
}

export interface RequestRecoveryEmailInput {
  operationId: string;

  userId: string;

  currentSessionId: string | undefined;

  expectedPrimaryEmail: string;

  expectedPasswordHash: string;

  recoveryEmail: string;

  rawCode: string;

  codeHash: string;

  requestedAt: Date;

  expiresAt: Date;

  expiresInMinutes: number;
}

export type RequestRecoveryEmailResult =
  | {
      status: 'requested';

      value: RecoveryEmailStatusRecord;
    }
  | {
      status: 'same_as_primary';
    }
  | {
      status: 'same_as_current';
    }
  | {
      status: 'email_in_use';
    }
  | {
      status: 'account_unavailable';
    }
  | {
      status: 'conflict';
    };

export interface VerifyRecoveryEmailInput {
  userId: string;

  currentSessionId: string | undefined;

  codeHash: string;

  verifiedAt: Date;

  maxAttempts: number;
}

export type VerifyRecoveryEmailResult =
  | {
      status: 'verified';

      value: RecoveryEmailStatusRecord;
    }
  | {
      status: 'invalid';

      attemptsRemaining: number;
    }
  | {
      status: 'expired';

      expiresAt: Date;
    }
  | {
      status: 'attempts_exceeded';
    }
  | {
      status: 'no_pending';
    }
  | {
      status: 'email_in_use';
    };

export interface ResendRecoveryEmailInput {
  operationId: string;

  userId: string;

  currentSessionId: string | undefined;

  rawCode: string;

  codeHash: string;

  requestedAt: Date;

  expiresAt: Date;

  expiresInMinutes: number;

  cooldownSeconds: number;

  maxResends: number;
}

export type ResendRecoveryEmailResult =
  | {
      status: 'sent';

      value: RecoveryEmailStatusRecord;
    }
  | {
      status: 'no_pending';
    }
  | {
      status: 'too_soon';

      retryAfterSeconds: number;
    }
  | {
      status: 'resend_limit';
    }
  | {
      status: 'email_in_use';
    }
  | {
      status: 'conflict';
    };

export interface RemoveRecoveryEmailInput {
  userId: string;

  currentSessionId: string | undefined;

  expectedPasswordHash: string;

  removedAt: Date;
}

export type RemoveRecoveryEmailResult =
  | {
      status: 'removed';

      value: RecoveryEmailStatusRecord;
    }
  | {
      status: 'account_unavailable';
    }
  | {
      status: 'conflict';
    };

export interface RecoveryEmailPersistencePort {
  findCredentialByUserId(
    userId: string,
  ): Promise<RecoveryEmailCredentialRecord | null>;

  findStatusByUserId(userId: string): Promise<RecoveryEmailStatusRecord | null>;

  request(
    input: RequestRecoveryEmailInput,
  ): Promise<RequestRecoveryEmailResult>;

  verify(input: VerifyRecoveryEmailInput): Promise<VerifyRecoveryEmailResult>;

  resend(input: ResendRecoveryEmailInput): Promise<ResendRecoveryEmailResult>;

  remove(input: RemoveRecoveryEmailInput): Promise<RemoveRecoveryEmailResult>;
}

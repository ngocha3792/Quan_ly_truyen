export const PASSWORD_RESET_PERSISTENCE_PORT = Symbol(
  'AUTH_PASSWORD_RESET_PERSISTENCE_PORT',
);

export interface RequestPasswordResetInput {
  email: string;

  rawToken: string;
  tokenHash: string;

  expiresAt: Date;
  expiresInMinutes: number;
}

export type RequestPasswordResetStatus = 'queued' | 'ignored';

export interface ValidatePasswordResetTokenInput {
  tokenHash: string;

  now: Date;
}

export type ValidatePasswordResetTokenPersistenceResult =
  | {
      status: 'valid';

      expiresAt: Date;
    }
  | {
      status: 'expired';

      expiresAt: Date;
    }
  | {
      status: 'invalid';
    };

export interface ResetPasswordInput {
  tokenHash: string;
  passwordHash: string;
  resetAt: Date;
}

export interface PasswordResetSuccess {
  userId: string;
  email: string;

  sessionsRevoked: number;
  resetAt: Date;
}

export type ResetPasswordPersistenceResult =
  | ({
      status: 'reset';
    } & PasswordResetSuccess)
  | {
      status: 'expired';
      expiresAt: Date;
    }
  | {
      status: 'invalid';
    };

export interface PasswordResetPersistencePort {
  request(
    input: RequestPasswordResetInput,
  ): Promise<RequestPasswordResetStatus>;

  validate(
    input: ValidatePasswordResetTokenInput,
  ): Promise<ValidatePasswordResetTokenPersistenceResult>;

  reset(input: ResetPasswordInput): Promise<ResetPasswordPersistenceResult>;
}

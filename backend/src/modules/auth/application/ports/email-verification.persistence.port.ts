export const EMAIL_VERIFICATION_PERSISTENCE_PORT = Symbol(
  'AUTH_EMAIL_VERIFICATION_PERSISTENCE_PORT',
);

export interface ConsumeEmailVerificationTokenInput {
  tokenHash: string;
  verifiedAt: Date;
}

export interface EmailVerificationSuccess {
  userId: string;
  email: string;
  verifiedAt: Date;
}

export type ConsumeEmailVerificationTokenResult =
  | ({
      status: 'verified';
    } & EmailVerificationSuccess)
  | ({
      status: 'already_verified';
    } & EmailVerificationSuccess)
  | {
      status: 'expired';
      expiresAt: Date;
    }
  | {
      status: 'invalid';
    };

export interface EmailVerificationPersistencePort {
  /**
   * Consume verification token và cập nhật emailVerifiedAt
   * trong cùng một database transaction.
   */
  consume(
    input: ConsumeEmailVerificationTokenInput,
  ): Promise<ConsumeEmailVerificationTokenResult>;
}

export interface RecoveryEmailStatusResultDto {
  email: string | null;

  verified: boolean;

  verifiedAt: Date | null;

  pendingEmail: string | null;

  pendingExpiresAt: Date | null;
}

export interface RecoveryEmailResponse {
  email: string | null;

  verified: boolean;

  verifiedAt: string | null;

  pendingEmail: string | null;

  pendingExpiresAt: string | null;
}

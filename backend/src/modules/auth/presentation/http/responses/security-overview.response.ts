export interface SecurityOverviewResponse {
  passwordConfigured: boolean;

  passwordUpdatedAt: string | null;

  mfaEnabled: boolean;

  mfaConfiguredAt: string | null;

  recoveryEmail: string | null;

  recoveryEmailVerified: boolean;

  securityQuestionsConfigured: boolean;

  trustedDeviceCount: number;
}

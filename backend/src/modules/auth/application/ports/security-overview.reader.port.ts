export const SECURITY_OVERVIEW_READER_PORT = Symbol(
  'AUTH_SECURITY_OVERVIEW_READER_PORT',
);

export interface SecurityOverviewRecord {
  passwordConfigured: boolean;

  passwordUpdatedAt: Date | null;

  mfaEnabled: boolean;

  mfaConfiguredAt: Date | null;

  recoveryEmail: string | null;

  recoveryEmailVerified: boolean;

  securityQuestionsConfigured: boolean;

  trustedDeviceCount: number;
}

export interface SecurityOverviewReaderPort {
  findByUserId(
    userId: string,
    now: Date,
  ): Promise<SecurityOverviewRecord | null>;
}

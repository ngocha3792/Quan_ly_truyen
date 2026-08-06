export interface SecurityOverviewResultDto {
    passwordConfigured: boolean;
    passwordUpdatedAt: Date | null;

    mfaEnabled: boolean;
    mfaConfiguredAt: Date | null;

    recoveryEmail: string | null;
    recoveryEmailVerified: boolean;

    securityQuestionsConfigured: boolean;
    trustedDeviceCount: number;
}
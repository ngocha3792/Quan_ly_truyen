export interface AccountSecurityOverview {
    readonly passwordConfigured: boolean;
    readonly passwordUpdatedAt: string | null;

    readonly mfaEnabled: boolean;
    readonly mfaConfiguredAt: string | null;

    readonly recoveryEmail: string | null;
    readonly recoveryEmailVerified: boolean;

    readonly securityQuestionsConfigured: boolean;
    readonly trustedDeviceCount: number;
}

export interface ChangePasswordRequest {
    readonly currentPassword: string;
    readonly newPassword: string;
}

export interface DeleteAccountRequest {
    readonly password: string;
    readonly confirmation: string;
}

export type SecurityLevel =
    | 'excellent'
    | 'good'
    | 'medium'
    | 'low';

export interface SecurityScoreItem {
    readonly id:
    | 'password'
    | 'mfa'
    | 'recovery-email'
    | 'security-questions'
    | 'trusted-device';

    readonly label: string;
    readonly description: string;
    readonly completed: boolean;
}

export interface SecurityScore {
    readonly percent: number;
    readonly label: string;
    readonly description: string;
    readonly level: SecurityLevel;
    readonly items: readonly SecurityScoreItem[];
}

export const EMPTY_SECURITY_OVERVIEW:
    AccountSecurityOverview = {
    passwordConfigured: true,
    passwordUpdatedAt: null,

    mfaEnabled: false,
    mfaConfiguredAt: null,

    recoveryEmail: null,
    recoveryEmailVerified: false,

    securityQuestionsConfigured: false,
    trustedDeviceCount: 0,
};
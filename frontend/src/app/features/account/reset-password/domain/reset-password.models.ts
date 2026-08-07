
export type ResetPasswordStatus =
    | 'idle'
    | 'validating'
    | 'ready'
    | 'submitting'
    | 'success'
    | 'expired'
    | 'invalid'
    | 'error';

export interface ResetPasswordConfig {
    readonly minimumLength: number;
    readonly maximumLength: number;
    readonly tokenExpiresInMinutes: number;
}

export interface ResetPasswordTokenRequest {
    readonly token: string;
}

export interface ResetPasswordTokenValidation {
    readonly email: string;
    readonly expiresAt: string;
    readonly isValid: boolean;
}

export interface ResetPasswordRequest {
    readonly token: string;
    readonly newPassword: string;
}

export interface ResetPasswordResult {
    readonly email: string;
    readonly changedAt: string;
    readonly message: string;
}
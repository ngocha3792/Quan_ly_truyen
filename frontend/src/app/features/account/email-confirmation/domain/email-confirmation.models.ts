
export type EmailConfirmationStatus =
    | 'idle'
    | 'confirming'
    | 'success'
    | 'expired'
    | 'error';

export interface EmailConfirmationRequest {
    readonly token: string;
}

export interface EmailConfirmationResult {
    readonly email: string;
    readonly confirmedAt: string;
    readonly message: string;
}

export interface EmailConfirmationView {
    readonly status: EmailConfirmationStatus;
    readonly result: EmailConfirmationResult | null;
    readonly errorMessage: string;
}
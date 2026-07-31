export interface ApiValidationIssue {
    field: string;
    code: string;
    message: string;
}

export interface ApiErrorDetails {
    code: string;
    message: string;

    issues?: readonly ApiValidationIssue[];
    metadata?: Record<string, unknown>;
}

export interface ApiErrorResponse {
    success: false;
    error: ApiErrorDetails;

    requestId: string;
    timestamp: string;
    path?: string;
}
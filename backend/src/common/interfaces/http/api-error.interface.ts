import { ValidationIssue } from '@/common/exceptions';

export interface ApiErrorDetails {
    code: string;
    message: string;
    issues?: readonly ValidationIssue[];
    details?: Record<string, unknown>;
}

export type { ApiErrorResponse } from './api-response.interface';
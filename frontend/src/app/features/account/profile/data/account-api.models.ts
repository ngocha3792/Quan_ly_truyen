export interface AccountSession {
    readonly id: string;
    readonly isCurrent: boolean;

    readonly deviceId: string | null;
    readonly deviceName: string | null;

    readonly ipAddress: string | null;
    readonly userAgent: string | null;

    readonly lastUsedAt: string | null;
    readonly createdAt: string;
    readonly expiresAt: string;
}

export interface AccountSessionsResponse {
    readonly sessions: readonly AccountSession[];
    readonly total: number;
}

export interface AccountSecurityEvent {
    readonly id: string;

    readonly action: string;
    readonly entityType: string;
    readonly entityId: string | null;

    readonly metadata:
    | Readonly<Record<string, unknown>>
    | null;

    readonly ipAddress: string | null;
    readonly userAgent: string | null;
    readonly requestId: string | null;

    readonly createdAt: string;
}

export interface AccountSecurityEventsResponse {
    readonly events:
    readonly AccountSecurityEvent[];

    readonly total: number;
}

export type AccountSecurityTone =
    | 'high'
    | 'medium'
    | 'low';

export interface AccountSecuritySummary {
    readonly score: number;
    readonly label: string;
    readonly description: string;
    readonly tone: AccountSecurityTone;
}
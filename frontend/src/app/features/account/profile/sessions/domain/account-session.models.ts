export interface AccountSessionDto {
    readonly id: string;
    readonly isCurrent: boolean;

    readonly deviceId: string | null;
    readonly deviceName: string | null;

    readonly ipAddress: string | null;
    readonly userAgent: string | null;

    readonly lastUsedAt: string | null;
    readonly createdAt: string;
    readonly expiresAt: string;

    /**
     * Các trường tùy chọn để frontend tương thích
     * khi backend được mở rộng trong tương lai.
     */
    readonly revokedAt?: string | null;
    readonly trusted?: boolean;
    readonly location?: string | null;

    readonly metadata?:
    | Readonly<Record<string, unknown>>
    | null;
}

export interface AccountSessionsResponse {
    readonly sessions: readonly AccountSessionDto[];
    readonly total: number;
}

export interface AccountSecurityEventDto {
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
    readonly AccountSecurityEventDto[];

    readonly total: number;
}

export type SessionBrowser =
    | 'chrome'
    | 'edge'
    | 'firefox'
    | 'safari'
    | 'opera'
    | 'browser';

export type SessionDeviceType =
    | 'desktop'
    | 'mobile'
    | 'tablet'
    | 'unknown';

export type SessionStatus =
    | 'current'
    | 'active'
    | 'expired'
    | 'revoked';

export type SessionFilter =
    | 'all'
    | 'active'
    | 'expired'
    | 'trusted';

export interface SessionDeviceInfo {
    readonly browser: SessionBrowser;
    readonly browserName: string;
    readonly browserVersion: string | null;

    readonly operatingSystem: string;
    readonly deviceType: SessionDeviceType;
}

export interface AccountSessionViewModel {
    readonly id: string;
    readonly isCurrent: boolean;
    readonly trusted: boolean;

    readonly title: string;
    readonly subtitle: string;

    readonly browser: SessionBrowser;
    readonly browserName: string;
    readonly operatingSystem: string;
    readonly deviceType: SessionDeviceType;

    readonly location: string;
    readonly ipAddress: string | null;

    readonly lastUsedAt: string;
    readonly createdAt: string;
    readonly expiresAt: string;

    readonly status: SessionStatus;
    readonly statusLabel: string;

    readonly canRevoke: boolean;
}

export interface LoginActivityViewModel {
    readonly id: string;

    readonly browser: SessionBrowser;
    readonly title: string;
    readonly subtitle: string;

    readonly location: string;
    readonly ipAddress: string | null;

    readonly occurredAt: string;

    readonly status:
    | 'current'
    | 'active'
    | 'signed-out';

    readonly statusLabel: string;
}
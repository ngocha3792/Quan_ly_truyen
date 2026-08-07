export interface AccountSecurityEventDto {
  readonly id: string;
  readonly action: string;

  readonly entityType: string;
  readonly entityId: string | null;

  readonly metadata: Readonly<Record<string, unknown>> | null;

  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly requestId: string | null;

  readonly createdAt: string;
}

export interface AccountSecurityEventsResponse {
  readonly events: readonly AccountSecurityEventDto[];
  readonly total: number;
}

export interface ActivitySessionDto {
  readonly id: string;
  readonly isCurrent: boolean;

  readonly deviceName: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;

  readonly lastUsedAt: string | null;
  readonly createdAt: string;
  readonly expiresAt: string;

  readonly revokedAt?: string | null;
  readonly location?: string | null;
}

export interface ActivitySessionsResponse {
  readonly sessions: readonly ActivitySessionDto[];
  readonly total: number;
}

export type ActivityCategory = 'all' | 'login' | 'security' | 'account' | 'device';

export type ActivityTone = 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'neutral';

export type ActivityVisual =
  | 'login'
  | 'logout'
  | 'password'
  | 'mfa'
  | 'email'
  | 'session'
  | 'profile'
  | 'device'
  | 'warning'
  | 'generic';

export type ActivityStatus = 'success' | 'warning' | 'info' | 'neutral';

export interface AccountActivityViewModel {
  readonly id: string;
  readonly action: string;

  readonly title: string;
  readonly description: string;

  readonly category: Exclude<ActivityCategory, 'all'>;

  readonly visual: ActivityVisual;
  readonly tone: ActivityTone;

  readonly status: ActivityStatus;
  readonly statusLabel: string | null;

  readonly browserName: string;
  readonly operatingSystem: string;
  readonly deviceLabel: string;

  readonly location: string;
  readonly ipAddress: string | null;

  readonly occurredAt: string;
  readonly suspicious: boolean;
}

export interface RecentDeviceViewModel {
  readonly id: string;
  readonly deviceName: string;
  readonly description: string;

  readonly operatingSystem: string;
  readonly browserName: string;

  readonly location: string;
  readonly ipAddress: string | null;

  readonly lastUsedAt: string;
  readonly current: boolean;
  readonly active: boolean;
}

export interface ActivitySummary {
  readonly total: number;
  readonly loginCount: number;
  readonly securityCount: number;
  readonly activeDeviceCount: number;
}

export interface WeeklySummaryItem {
  readonly id: 'login' | 'security' | 'device' | 'account';

  readonly label: string;
  readonly count: number;
  readonly percent: number;

  readonly tone: 'purple' | 'green' | 'orange' | 'blue';
}

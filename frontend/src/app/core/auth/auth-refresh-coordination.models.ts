export const AUTH_REFRESH_LOCK_NAME = 'truyenhub.auth.refresh-token-rotation';

export const AUTH_REFRESH_LEASE_STORAGE_KEY = 'truyenhub.auth.refresh-token-rotation.lease.v1';

export const AUTH_REFRESH_COORDINATION_CHANNEL_NAME =
  'truyenhub.auth.refresh-token-rotation.fallback.v1';

export interface AuthRefreshLease {
  readonly ownerId: string;
  readonly leaseId: string;
  readonly expiresAt: number;
}

export type AuthRefreshCoordinationMessage =
  | {
      readonly type: 'lease-updated';
      readonly ownerId: string;
      readonly leaseId: string;
    }
  | {
      readonly type: 'lease-released';
      readonly ownerId: string;
      readonly leaseId: string;
    };

export class AuthRefreshCoordinationUnavailableError extends Error {
  constructor() {
    super(
      [
        'Không thể đồng bộ an toàn phiên đăng nhập giữa các tab.',
        'Trình duyệt không cung cấp Web Locks hoặc localStorage khả dụng.',
      ].join(' '),
    );

    this.name = 'AuthRefreshCoordinationUnavailableError';
  }
}

export function createCoordinationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return [Date.now().toString(36), Math.random().toString(36).slice(2)].join('-');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

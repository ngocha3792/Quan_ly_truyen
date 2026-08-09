import {
  AUTH_REFRESH_COORDINATION_CHANNEL_NAME,
  AUTH_REFRESH_LEASE_STORAGE_KEY,
  AuthRefreshCoordinationMessage,
  isRecord,
} from './auth-refresh-coordination.models';

/**
 * Chỉ đảm nhiệm đánh thức các waiter khi lease thay đổi.
 * Correctness vẫn thuộc về storage lease; channel là một tối ưu độ trễ.
 */
export class AuthRefreshCoordinationChannel {
  private readonly waiters = new Set<() => void>();
  private channel: BroadcastChannel | null = null;
  private destroyed = false;

  constructor() {
    window.addEventListener('storage', this.handleStorageEvent);
    this.channel = createBroadcastChannel();
    this.channel?.addEventListener('message', this.handleBroadcastMessage);
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  waitForChange(timeoutMs: number): Promise<void> {
    if (this.destroyed) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      let settled = false;

      const finish = (): void => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        this.waiters.delete(finish);
        resolve();
      };

      const timer = setTimeout(finish, timeoutMs);
      this.waiters.add(finish);
    });
  }

  broadcast(message: AuthRefreshCoordinationMessage): void {
    try {
      this.channel?.postMessage(message);
    } catch {
      // BroadcastChannel is optional; polling/storage events still make progress.
    }
  }

  notifyLocalWaiters(): void {
    for (const wake of [...this.waiters]) {
      wake();
    }
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.notifyLocalWaiters();
    window.removeEventListener('storage', this.handleStorageEvent);
    this.channel?.removeEventListener('message', this.handleBroadcastMessage);
    this.channel?.close();
    this.channel = null;
  }

  private readonly handleStorageEvent = (event: StorageEvent): void => {
    if (event.key === AUTH_REFRESH_LEASE_STORAGE_KEY) {
      this.notifyLocalWaiters();
    }
  };

  private readonly handleBroadcastMessage = (event: MessageEvent<unknown>): void => {
    if (isCoordinationMessage(event.data)) {
      this.notifyLocalWaiters();
    }
  };
}

function createBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }

  try {
    return new BroadcastChannel(AUTH_REFRESH_COORDINATION_CHANNEL_NAME);
  } catch {
    return null;
  }
}

function isCoordinationMessage(value: unknown): value is AuthRefreshCoordinationMessage {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value['type'] === 'lease-updated' || value['type'] === 'lease-released') &&
    typeof value['ownerId'] === 'string' &&
    typeof value['leaseId'] === 'string'
  );
}

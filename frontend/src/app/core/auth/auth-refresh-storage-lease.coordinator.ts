import { firstValueFrom, Observable } from 'rxjs';

import { AuthRefreshCoordinationChannel } from './auth-refresh-coordination-channel';
import {
  AUTH_REFRESH_LEASE_STORAGE_KEY,
  AuthRefreshCoordinationUnavailableError,
  AuthRefreshLease,
  createCoordinationId,
  isRecord,
} from './auth-refresh-coordination.models';

const LEASE_TTL_MS = 30_000;
const LEASE_HEARTBEAT_MS = 5_000;
const MAX_WAIT_SLICE_MS = 100;
const MIN_WAIT_SLICE_MS = 20;
const CONTENTION_WINDOW_MS = 20;
const CLAIM_SETTLE_MS = 25;

export class AuthRefreshStorageLeaseCoordinator {
  private readonly ownerId = createCoordinationId();
  private readonly storage = resolveLocalStorage();
  private readonly channel = new AuthRefreshCoordinationChannel();

  get isAvailable(): boolean {
    return this.storage !== null;
  }

  async runExclusive<T>(operation: () => Observable<T>): Promise<T> {
    const storage = this.storage;

    if (!storage) {
      throw new AuthRefreshCoordinationUnavailableError();
    }

    const lease = await this.acquireLease(storage);
    this.renewLease(storage, lease);

    const heartbeatId = window.setInterval(
      () => this.renewLease(storage, lease),
      LEASE_HEARTBEAT_MS,
    );

    try {
      return await firstValueFrom(operation());
    } finally {
      window.clearInterval(heartbeatId);
      this.releaseLease(storage, lease);
    }
  }

  destroy(): void {
    this.channel.destroy();
  }

  private async acquireLease(storage: Storage): Promise<AuthRefreshLease> {
    while (!this.channel.isDestroyed) {
      let current = readLease(storage);
      const now = Date.now();

      if (!current || isLeaseExpired(current, now)) {
        await sleep(createContentionDelay());

        if (this.channel.isDestroyed) {
          break;
        }

        current = readLease(storage);
        const afterContentionNow = Date.now();

        if (!current || isLeaseExpired(current, afterContentionNow)) {
          const candidate: AuthRefreshLease = {
            ownerId: this.ownerId,
            leaseId: createCoordinationId(),
            expiresAt: afterContentionNow + LEASE_TTL_MS,
          };

          if (!writeLease(storage, candidate)) {
            throw new AuthRefreshCoordinationUnavailableError();
          }

          this.channel.broadcast({
            type: 'lease-updated',
            ownerId: candidate.ownerId,
            leaseId: candidate.leaseId,
          });

          await sleep(CLAIM_SETTLE_MS);

          const confirmed = readLease(storage);
          if (confirmed && sameLease(confirmed, candidate)) {
            return candidate;
          }

          continue;
        }
      }

      const observed = readLease(storage);
      if (!observed || isLeaseExpired(observed, Date.now())) {
        continue;
      }

      await this.channel.waitForChange(calculateWaitSlice(observed));
    }

    throw new AuthRefreshCoordinationUnavailableError();
  }

  private renewLease(storage: Storage, lease: AuthRefreshLease): void {
    const current = readLease(storage);
    if (!current || !sameLease(current, lease)) {
      return;
    }

    writeLease(storage, {
      ...lease,
      expiresAt: Date.now() + LEASE_TTL_MS,
    });
  }

  private releaseLease(storage: Storage, lease: AuthRefreshLease): void {
    const current = readLease(storage);

    if (current && sameLease(current, lease)) {
      try {
        storage.removeItem(AUTH_REFRESH_LEASE_STORAGE_KEY);
      } catch {
        // TTL allows another tab to recover if removeItem fails.
      }
    }

    this.channel.broadcast({
      type: 'lease-released',
      ownerId: lease.ownerId,
      leaseId: lease.leaseId,
    });
    this.channel.notifyLocalWaiters();
  }
}

function resolveLocalStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    const probeKey = [AUTH_REFRESH_LEASE_STORAGE_KEY, 'probe', createCoordinationId()].join('.');
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}

function readLease(storage: Storage): AuthRefreshLease | null {
  try {
    const raw = storage.getItem(AUTH_REFRESH_LEASE_STORAGE_KEY);
    return raw ? parseLease(JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function writeLease(storage: Storage, lease: AuthRefreshLease): boolean {
  try {
    storage.setItem(AUTH_REFRESH_LEASE_STORAGE_KEY, JSON.stringify(lease));
    return true;
  } catch {
    return false;
  }
}

function parseLease(value: unknown): AuthRefreshLease | null {
  if (!isRecord(value)) {
    return null;
  }

  const ownerId = value['ownerId'];
  const leaseId = value['leaseId'];
  const expiresAt = value['expiresAt'];

  if (
    typeof ownerId !== 'string' ||
    !ownerId.trim() ||
    typeof leaseId !== 'string' ||
    !leaseId.trim() ||
    typeof expiresAt !== 'number' ||
    !Number.isFinite(expiresAt)
  ) {
    return null;
  }

  return { ownerId, leaseId, expiresAt };
}

function sameLease(left: AuthRefreshLease, right: AuthRefreshLease): boolean {
  return left.ownerId === right.ownerId && left.leaseId === right.leaseId;
}

function isLeaseExpired(lease: AuthRefreshLease, now: number): boolean {
  return lease.expiresAt <= now;
}

function calculateWaitSlice(lease: AuthRefreshLease): number {
  const untilExpiry = lease.expiresAt - Date.now() + 1;
  return Math.min(MAX_WAIT_SLICE_MS, Math.max(MIN_WAIT_SLICE_MS, untilExpiry));
}

function createContentionDelay(): number {
  return Math.floor(Math.random() * (CONTENTION_WINDOW_MS + 1));
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

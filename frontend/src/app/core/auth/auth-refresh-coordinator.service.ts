import { Injectable, OnDestroy } from '@angular/core';

import { defer, firstValueFrom, from, Observable } from 'rxjs';

const AUTH_REFRESH_LOCK_NAME = 'truyenhub.auth.refresh-token-rotation';

const AUTH_REFRESH_LEASE_STORAGE_KEY = 'truyenhub.auth.refresh-token-rotation.lease.v1';

const AUTH_REFRESH_COORDINATION_CHANNEL_NAME = 'truyenhub.auth.refresh-token-rotation.fallback.v1';

/**
 * Lease đủ dài để refresh request bình thường
 * không bị tab khác cướp giữa chừng.
 *
 * Heartbeat sẽ gia hạn khi operation vẫn chạy.
 */
const LEASE_TTL_MS = 30_000;

const LEASE_HEARTBEAT_MS = 5_000;

/**
 * Khi không có storage event/BroadcastChannel,
 * waiter vẫn poll localStorage theo khoảng này.
 */
const MAX_WAIT_SLICE_MS = 100;

const MIN_WAIT_SLICE_MS = 20;

/**
 * Hai tab có thể cùng nhìn thấy "chưa có lease"
 * gần như đồng thời.
 *
 * Thêm contention window + settle window trước
 * khi coi lease là acquired.
 */
const CONTENTION_WINDOW_MS = 20;

const CLAIM_SETTLE_MS = 25;

interface AuthRefreshLease {
  readonly ownerId: string;

  readonly leaseId: string;

  readonly expiresAt: number;
}

type AuthRefreshCoordinationMessage =
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

@Injectable({
  providedIn: 'root',
})
export class AuthRefreshCoordinatorService implements OnDestroy {
  /**
   * Mỗi Angular app/tab có một owner id riêng.
   */
  private readonly ownerId = createCoordinationId();

  private readonly useWebLocks: boolean;

  private storage: Storage | null = null;

  private channel: BroadcastChannel | null = null;

  private readonly waiters = new Set<() => void>();

  private destroyed = false;

  constructor() {
    this.useWebLocks = browserSupportsWebLocks();

    /**
     * Web Locks là implementation ưu tiên.
     *
     * Khi đã có Web Locks thì không cần tạo
     * localStorage lease/BroadcastChannel.
     */
    if (this.useWebLocks) {
      return;
    }

    /**
     * SSR/server context không có nhiều browser tab,
     * nên không cần fallback coordination.
     */
    if (typeof window === 'undefined') {
      return;
    }

    this.storage = resolveLocalStorage();

    window.addEventListener(
      'storage',

      this.handleStorageEvent,
    );

    this.channel = createCoordinationChannel();

    this.channel?.addEventListener(
      'message',

      this.handleBroadcastMessage,
    );
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    this.notifyWaiters();

    if (typeof window !== 'undefined') {
      window.removeEventListener(
        'storage',

        this.handleStorageEvent,
      );
    }

    if (this.channel) {
      this.channel.removeEventListener(
        'message',

        this.handleBroadcastMessage,
      );

      this.channel.close();

      this.channel = null;
    }
  }

  runExclusive<T>(operation: () => Observable<T>): Observable<T> {
    /**
     * Ưu tiên native Web Locks.
     *
     * Điểm quan trọng:
     *
     * operation() chỉ được gọi BÊN TRONG callback
     * của lock.
     *
     * Vì vậy HttpClient chỉ đọc refresh cookie
     * sau khi tab trước đã rotate xong.
     */
    if (this.useWebLocks) {
      return defer(async () => {
        return await navigator.locks.request(
          AUTH_REFRESH_LOCK_NAME,
          {
            mode: 'exclusive',
          },
          async () => await firstValueFrom(operation()),
        );
      });
    }

    /**
     * SSR không có cross-tab browser context.
     */
    if (typeof window === 'undefined') {
      return defer(operation);
    }

    /**
     * Không có Web Locks và localStorage cũng
     * không khả dụng:
     *
     * FAIL CLOSED.
     *
     * Không gọi refresh trực tiếp vì hai tab có thể
     * dùng cùng refresh token và backend sẽ coi đó
     * là reuse attack.
     */
    if (!this.storage) {
      return defer(() => {
        throw new AuthRefreshCoordinationUnavailableError();
      });
    }

    return defer(() =>
      from(
        this.runWithFallbackLease(
          this.storage!,

          operation,
        ),
      ),
    );
  }

  private async runWithFallbackLease<T>(
    storage: Storage,

    operation: () => Observable<T>,
  ): Promise<T> {
    const lease = await this.acquireLease(storage);

    /**
     * Gia hạn ngay trước khi chạy operation để
     * TTL luôn còn đầy đủ.
     */
    this.renewLease(
      storage,

      lease,
    );

    const heartbeatId = window.setInterval(
      () => {
        this.renewLease(
          storage,

          lease,
        );
      },

      LEASE_HEARTBEAT_MS,
    );

    try {
      /**
       * Http request chỉ được subscribe sau khi
       * lease thực sự thuộc tab hiện tại.
       */
      return await firstValueFrom(operation());
    } finally {
      window.clearInterval(heartbeatId);

      this.releaseLease(
        storage,

        lease,
      );
    }
  }

  private async acquireLease(storage: Storage): Promise<AuthRefreshLease> {
    while (!this.destroyed) {
      let current = this.readLease(storage);

      const now = Date.now();

      if (
        !current ||
        isLeaseExpired(
          current,

          now,
        )
      ) {
        /**
         * Giảm xác suất hai browser context cùng
         * đọc "empty" rồi cùng write lease.
         */
        await sleep(createContentionDelay());

        if (this.destroyed) {
          break;
        }

        /**
         * Bắt buộc re-read sau contention window.
         */
        current = this.readLease(storage);

        const afterContentionNow = Date.now();

        if (
          !current ||
          isLeaseExpired(
            current,

            afterContentionNow,
          )
        ) {
          const candidate: AuthRefreshLease = {
            ownerId: this.ownerId,

            leaseId: createCoordinationId(),

            expiresAt: afterContentionNow + LEASE_TTL_MS,
          };

          if (
            !this.writeLease(
              storage,

              candidate,
            )
          ) {
            throw new AuthRefreshCoordinationUnavailableError();
          }

          this.broadcast({
            type: 'lease-updated',

            ownerId: candidate.ownerId,

            leaseId: candidate.leaseId,
          });

          /**
           * Không chạy operation ngay sau setItem.
           *
           * Cho contender khác một khoảng ngắn để
           * claim của nó trở nên observable.
           */
          await sleep(CLAIM_SETTLE_MS);

          const confirmed = this.readLease(storage);

          if (
            confirmed &&
            sameLease(
              confirmed,

              candidate,
            )
          ) {
            return candidate;
          }

          /**
           * Một contender khác thắng.
           * Quay lại vòng while để đợi lease đó.
           */
          continue;
        }
      }

      /**
       * Có owner khác đang giữ lease.
       */
      const observed = this.readLease(storage);

      if (!observed) {
        continue;
      }

      if (
        isLeaseExpired(
          observed,

          Date.now(),
        )
      ) {
        continue;
      }

      await this.waitForLeaseChange(calculateWaitSlice(observed));
    }

    throw new AuthRefreshCoordinationUnavailableError();
  }

  private renewLease(
    storage: Storage,

    lease: AuthRefreshLease,
  ): void {
    const current = this.readLease(storage);

    /**
     * Chỉ owner thật sự hiện tại mới được renew.
     *
     * Nếu vì lý do nào đó lease đã bị thay thế,
     * tuyệt đối không overwrite lease của tab khác.
     */
    if (
      !current ||
      !sameLease(
        current,

        lease,
      )
    ) {
      return;
    }

    const renewed: AuthRefreshLease = {
      ...lease,

      expiresAt: Date.now() + LEASE_TTL_MS,
    };

    this.writeLease(
      storage,

      renewed,
    );
  }

  private releaseLease(
    storage: Storage,

    lease: AuthRefreshLease,
  ): void {
    const current = this.readLease(storage);

    /**
     * Không được xóa lease nếu tab khác đã
     * takeover ownership.
     */
    if (
      current &&
      sameLease(
        current,

        lease,
      )
    ) {
      try {
        storage.removeItem(AUTH_REFRESH_LEASE_STORAGE_KEY);
      } catch {
        /**
         * Nếu remove fail thì lease vẫn có TTL.
         * Tab khác cuối cùng vẫn recovery được.
         */
      }
    }

    this.broadcast({
      type: 'lease-released',

      ownerId: lease.ownerId,

      leaseId: lease.leaseId,
    });

    /**
     * Wake waiter trong cùng JS context/test.
     */
    this.notifyWaiters();
  }

  private readLease(storage: Storage): AuthRefreshLease | null {
    let raw: string | null;

    try {
      raw = storage.getItem(AUTH_REFRESH_LEASE_STORAGE_KEY);
    } catch {
      return null;
    }

    if (!raw) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(raw);

      return parseLease(parsed);
    } catch {
      return null;
    }
  }

  private writeLease(
    storage: Storage,

    lease: AuthRefreshLease,
  ): boolean {
    try {
      storage.setItem(
        AUTH_REFRESH_LEASE_STORAGE_KEY,

        JSON.stringify(lease),
      );

      return true;
    } catch {
      return false;
    }
  }

  private waitForLeaseChange(timeoutMs: number): Promise<void> {
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

      const timer = setTimeout(
        finish,

        timeoutMs,
      );

      this.waiters.add(finish);
    });
  }

  private notifyWaiters(): void {
    const waiters = [...this.waiters];

    for (const wake of waiters) {
      wake();
    }
  }

  private broadcast(message: AuthRefreshCoordinationMessage): void {
    try {
      this.channel?.postMessage(message);
    } catch {
      /**
       * BroadcastChannel chỉ là wake-up optimization.
       *
       * Correctness vẫn dựa vào localStorage lease.
       */
    }
  }

  private readonly handleStorageEvent = (event: StorageEvent): void => {
    if (event.key !== AUTH_REFRESH_LEASE_STORAGE_KEY) {
      return;
    }

    this.notifyWaiters();
  };

  private readonly handleBroadcastMessage = (event: MessageEvent<unknown>): void => {
    if (!isCoordinationMessage(event.data)) {
      return;
    }

    this.notifyWaiters();
  };
}

function browserSupportsWebLocks(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function';
}

function resolveLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storage = window.localStorage;

    const probeKey = [AUTH_REFRESH_LEASE_STORAGE_KEY, 'probe', createCoordinationId()].join('.');

    storage.setItem(
      probeKey,

      '1',
    );

    storage.removeItem(probeKey);

    return storage;
  } catch {
    return null;
  }
}

function createCoordinationChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }

  try {
    return new BroadcastChannel(AUTH_REFRESH_COORDINATION_CHANNEL_NAME);
  } catch {
    return null;
  }
}

function createCoordinationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return [Date.now().toString(36), Math.random().toString(36).slice(2)].join('-');
}

function createContentionDelay(): number {
  return Math.floor(Math.random() * (CONTENTION_WINDOW_MS + 1));
}

function isLeaseExpired(
  lease: AuthRefreshLease,

  now: number,
): boolean {
  return lease.expiresAt <= now;
}

function sameLease(
  left: AuthRefreshLease,

  right: AuthRefreshLease,
): boolean {
  return left.ownerId === right.ownerId && left.leaseId === right.leaseId;
}

function calculateWaitSlice(lease: AuthRefreshLease): number {
  const untilExpiry = lease.expiresAt - Date.now() + 1;

  return Math.min(
    MAX_WAIT_SLICE_MS,

    Math.max(
      MIN_WAIT_SLICE_MS,

      untilExpiry,
    ),
  );
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

  return {
    ownerId,

    leaseId,

    expiresAt,
  };
}

function isCoordinationMessage(value: unknown): value is AuthRefreshCoordinationMessage {
  if (!isRecord(value)) {
    return false;
  }

  const type = value['type'];

  const ownerId = value['ownerId'];

  const leaseId = value['leaseId'];

  if (type !== 'lease-updated' && type !== 'lease-released') {
    return false;
  }

  return typeof ownerId === 'string' && typeof leaseId === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(
      resolve,

      milliseconds,
    );
  });
}

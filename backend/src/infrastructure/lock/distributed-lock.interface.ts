export interface LockOptions {
  ttlMs: number;
  waitMs?: number;
  autoExtend?: boolean;
  extensionIntervalMs?: number;
}

export interface DistributedLock {
  withLock<T>(
    key: string,
    options: LockOptions,
    work: () => Promise<T>,
  ): Promise<T>;
}

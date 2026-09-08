import type { OfflinePackageRecord, OfflineStorageEstimate } from './offline.models';
import { OfflineQuotaExceededError, OfflineStorageScopeError } from './offline.models';

export const OFFLINE_MAX_LOCAL_BYTES = 500 * 1024 * 1024;
const ORIGIN_QUOTA_FRACTION = 0.7;

export function isOfflineLicenseExpired(
  licenseExpiresAt: string | null,
  now = Date.now(),
): boolean {
  if (!licenseExpiresAt) return false;
  const expiry = Date.parse(licenseExpiresAt);
  return !Number.isFinite(expiry) || expiry <= now;
}

export function offlineByteStringToNumber(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new OfflineQuotaExceededError('Dung lượng gói offline không hợp lệ.');
  }

  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes < 0) {
    throw new OfflineQuotaExceededError('Dung lượng gói offline vượt giới hạn trình duyệt.');
  }

  return bytes;
}

export function resolveOfflineBudget(quotaBytes: number): number {
  if (!Number.isFinite(quotaBytes) || quotaBytes <= 0) return OFFLINE_MAX_LOCAL_BYTES;
  return Math.max(
    0,
    Math.min(OFFLINE_MAX_LOCAL_BYTES, Math.floor(quotaBytes * ORIGIN_QUOTA_FRACTION)),
  );
}

export function withOfflineUsage(
  usageBytes: number,
  quotaBytes: number,
  packages: readonly OfflinePackageRecord[],
): OfflineStorageEstimate {
  return {
    usageBytes: finiteNonNegative(usageBytes),
    quotaBytes: finiteNonNegative(quotaBytes),
    offlineBytes: packages.reduce((sum, item) => sum + occupiedBytes(item), 0),
    offlineBudgetBytes: resolveOfflineBudget(quotaBytes),
  };
}

export function selectOfflinePackagesForEviction(
  packages: readonly OfflinePackageRecord[],
  requiredBytes: number,
  budgetBytes: number,
  excludedPackageId?: string,
  now = Date.now(),
): readonly OfflinePackageRecord[] {
  if (!Number.isSafeInteger(requiredBytes) || requiredBytes < 0 || requiredBytes > budgetBytes) {
    throw new OfflineQuotaExceededError();
  }

  const retainedBytes = packages
    .filter(
      (item) =>
        item.id !== excludedPackageId && !isOfflineLicenseExpired(item.licenseExpiresAt, now),
    )
    .reduce((sum, item) => sum + occupiedBytes(item), 0);
  let bytesToFree = Math.max(0, retainedBytes + requiredBytes - budgetBytes);

  const candidates = packages
    .filter(
      (item) =>
        item.id !== excludedPackageId &&
        (item.downloadState === 'READY' ||
          isOfflineLicenseExpired(item.licenseExpiresAt, now) ||
          isOfflineReservationExpired(item, now)),
    )
    .sort((left, right) => {
      const leftExpired = isOfflineLicenseExpired(left.licenseExpiresAt, now);
      const rightExpired = isOfflineLicenseExpired(right.licenseExpiresAt, now);
      if (leftExpired !== rightExpired) return leftExpired ? -1 : 1;
      return Date.parse(left.lastAccessedAt) - Date.parse(right.lastAccessedAt);
    });

  const selected: OfflinePackageRecord[] = [];
  for (const item of candidates) {
    if (isOfflineLicenseExpired(item.licenseExpiresAt, now) || bytesToFree > 0) {
      selected.push(item);
      bytesToFree = Math.max(0, bytesToFree - occupiedBytes(item));
    }
  }

  if (bytesToFree > 0) throw new OfflineQuotaExceededError();
  return selected;
}

export function isOfflineReservationExpired(
  record: OfflinePackageRecord,
  now = Date.now(),
): boolean {
  if (record.downloadState !== 'DOWNLOADING') return false;
  const expiry = record.reservationExpiresAt ? Date.parse(record.reservationExpiresAt) : Number.NaN;
  return !Number.isFinite(expiry) || expiry <= now;
}

export function assertOfflineReservationReplaceable(
  existing: OfflinePackageRecord | undefined,
  reservationId: string,
  now = Date.now(),
): void {
  if (
    existing?.downloadState === 'DOWNLOADING' &&
    existing.reservationId !== reservationId &&
    !isOfflineReservationExpired(existing, now)
  ) {
    throw new OfflineStorageScopeError('Gói offline đang được tải ở tab khác.');
  }
}

function occupiedBytes(record: OfflinePackageRecord): number {
  return record.downloadState === 'DOWNLOADING' ? record.totalSizeBytes : record.downloadedBytes;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

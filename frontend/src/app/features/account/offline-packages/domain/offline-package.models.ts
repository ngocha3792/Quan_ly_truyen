export type OfflinePackageStatus = 'PREPARING' | 'READY' | 'EXPIRED' | 'REVOKED';

export interface OfflinePackageSummary {
  readonly id: string;
  readonly deviceId: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly status: OfflinePackageStatus;
  readonly totalSizeBytes: string;
  readonly chapterCount: number;
  readonly licenseExpiresAt: string | null;
  readonly lastAccessedAt: string;
  readonly autoDeleteAt: string;
  readonly revokedAt: string | null;
  readonly revokedReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OfflineQuota {
  readonly maxPackages: number;
  readonly maxTotalSizeBytes: string;
  readonly maxChaptersPerPackage: number;
  readonly currentPackages: number;
  readonly currentSizeBytes: string;
  readonly remainingPackages: number;
  readonly remainingSizeBytes: string;
}

export interface CreateOfflinePackageInput {
  readonly name: string;
  readonly description?: string;
  readonly chapterIds: readonly string[];
  readonly idempotencyKey: string;
}

export interface OfflineSourceStory {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly author: string;
  readonly coverUrl: string | null;
  readonly chapterCount: number;
  readonly inLibrary: boolean;
}

export interface OfflineSourceChapter {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly publishedAt: string;
}

export interface OfflineSourceChapterPage {
  readonly items: readonly OfflineSourceChapter[];
  readonly page: number;
  readonly totalPages: number;
}

export interface LocalStorageEstimate {
  readonly usageBytes: number;
  readonly quotaBytes: number;
}

export interface PackageDownloadProgress {
  readonly completed: number;
  readonly total: number;
  readonly percent: number;
  readonly phase: string;
}

export function isOfflinePackageExpired(
  offlinePackage: Pick<OfflinePackageSummary, 'status' | 'licenseExpiresAt'>,
  now = Date.now(),
): boolean {
  if (offlinePackage.status === 'EXPIRED' || offlinePackage.status === 'REVOKED') return true;
  if (!offlinePackage.licenseExpiresAt) return false;
  const expiry = Date.parse(offlinePackage.licenseExpiresAt);
  return Number.isFinite(expiry) && expiry <= now;
}

export function formatOfflineBytes(value: string | number): string {
  const parsed = typeof value === 'number' ? Math.max(0, value) : safeNumber(value);
  if (parsed < 1024) return `${Math.round(parsed)} B`;

  const units = ['KB', 'MB', 'GB', 'TB'] as const;
  let amount = parsed / 1024;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }

  return `${new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: amount >= 10 ? 1 : 2,
  }).format(amount)} ${units[unitIndex]}`;
}

export function offlineQuotaPercent(current: string, maximum: string): number {
  const max = safeNumber(maximum);
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (safeNumber(current) / max) * 100));
}

export function offlinePackageIdsToPurge(
  serverPackages: readonly OfflinePackageSummary[],
  localPackageIds: readonly string[],
  now = Date.now(),
): readonly string[] {
  const readableServerIds = new Set(
    serverPackages
      .filter((item) => item.status === 'READY' && !isOfflinePackageExpired(item, now))
      .map((item) => item.id),
  );
  return localPackageIds.filter((packageId) => !readableServerIds.has(packageId));
}

function safeNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

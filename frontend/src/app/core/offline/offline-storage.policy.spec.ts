import type { OfflinePackageRecord } from './offline.models';
import {
  assertOfflineReservationReplaceable,
  isOfflineLicenseExpired,
  resolveOfflineBudget,
  selectOfflinePackagesForEviction,
} from './offline-storage.policy';

describe('offline storage policy', () => {
  it('treats invalid or elapsed licenses as expired', () => {
    const now = Date.parse('2026-09-08T12:00:00.000Z');
    expect(isOfflineLicenseExpired(null, now)).toBe(false);
    expect(isOfflineLicenseExpired('not-a-date', now)).toBe(true);
    expect(isOfflineLicenseExpired('2026-09-08T11:59:59.000Z', now)).toBe(true);
    expect(isOfflineLicenseExpired('2026-09-08T12:00:01.000Z', now)).toBe(false);
  });

  it('removes expired packages first, then least recently used packages', () => {
    const now = Date.parse('2026-09-08T12:00:00.000Z');
    const packages = [
      packageRecord('expired', 20, '2026-09-08T11:00:00.000Z', '2026-09-01T00:00:00.000Z'),
      packageRecord('old', 60, '2026-09-01T00:00:00.000Z'),
      packageRecord('new', 60, '2026-09-08T10:00:00.000Z'),
    ];

    expect(
      selectOfflinePackagesForEviction(packages, 50, 140, undefined, now).map((x) => x.id),
    ).toEqual(['expired', 'old']);
  });

  it('caps the browser allocation and rejects a package larger than the budget', () => {
    expect(resolveOfflineBudget(1_000)).toBe(700);
    expect(resolveOfflineBudget(2_000_000_000)).toBe(500 * 1024 * 1024);
    expect(() => selectOfflinePackagesForEviction([], 101, 100)).toThrowError(/dung lượng/i);
  });

  it('counts but never evicts a live cross-tab download reservation', () => {
    const activeDownload: OfflinePackageRecord = {
      ...packageRecord('download-a', 0, '2026-09-08T11:00:00.000Z'),
      downloadState: 'DOWNLOADING',
      totalSizeBytes: 80,
      reservationId: 'reservation-a',
      reservationExpiresAt: '2026-09-08T12:10:00.000Z',
    };

    expect(() =>
      selectOfflinePackagesForEviction(
        [activeDownload],
        30,
        100,
        'download-b',
        Date.parse('2026-09-08T12:00:00.000Z'),
      ),
    ).toThrowError(/dung lượng/i);
  });

  it('does not let another tab replace the same package reservation', () => {
    const existing: OfflinePackageRecord = {
      ...packageRecord('package-1', 0, '2026-09-08T11:00:00.000Z'),
      downloadState: 'DOWNLOADING',
      totalSizeBytes: 80,
      reservationId: 'reservation-a',
      reservationExpiresAt: '2026-09-08T12:10:00.000Z',
    };
    expect(() =>
      assertOfflineReservationReplaceable(
        existing,
        'reservation-b',
        Date.parse('2026-09-08T12:00:00.000Z'),
      ),
    ).toThrowError(/tab khác/);
  });
});

function packageRecord(
  id: string,
  downloadedBytes: number,
  lastAccessedAt: string,
  licenseExpiresAt = '2026-10-01T00:00:00.000Z',
): OfflinePackageRecord {
  return {
    id,
    name: id,
    description: null,
    status: 'READY',
    downloadState: 'READY',
    licenseExpiresAt,
    createdAt: '2026-09-01T00:00:00.000Z',
    chapterIds: [],
    assetUrls: [],
    chapterCount: 0,
    totalSizeBytes: downloadedBytes,
    downloadedBytes,
    downloadedAt: '2026-09-01T00:00:00.000Z',
    lastAccessedAt,
    reservationId: null,
    reservationExpiresAt: null,
  };
}

import { describe, expect, it } from 'vitest';

import {
  formatOfflineBytes,
  isOfflinePackageExpired,
  offlinePackageIdsToPurge,
  offlineQuotaPercent,
} from './offline-package.models';

describe('offline package view helpers', () => {
  it('formats server byte strings without parsing them at the HTTP boundary', () => {
    expect(formatOfflineBytes('0')).toBe('0 B');
    expect(formatOfflineBytes('1048576')).toBe('1 MB');
    expect(formatOfflineBytes(1_610_612_736)).toBe('1,5 GB');
  });

  it('clamps quota percentages to the progress-bar range', () => {
    expect(offlineQuotaPercent('25', '100')).toBe(25);
    expect(offlineQuotaPercent('150', '100')).toBe(100);
    expect(offlineQuotaPercent('10', '0')).toBe(0);
  });

  it('treats revoked status and elapsed licenses as unavailable', () => {
    const future = '2026-09-10T00:00:00.000Z';
    expect(
      isOfflinePackageExpired(
        { status: 'READY', licenseExpiresAt: future },
        Date.parse(future) - 1,
      ),
    ).toBe(false);
    expect(
      isOfflinePackageExpired({ status: 'READY', licenseExpiresAt: future }, Date.parse(future)),
    ).toBe(true);
    expect(
      isOfflinePackageExpired(
        { status: 'REVOKED', licenseExpiresAt: future },
        Date.parse(future) - 1,
      ),
    ).toBe(true);
  });

  it('purges missing and no-longer-readable local packages during reconciliation', () => {
    const now = Date.parse('2026-09-08T00:00:00.000Z');
    const base = {
      deviceId: null,
      name: 'Gói',
      description: null,
      totalSizeBytes: '10',
      chapterCount: 1,
      lastAccessedAt: '2026-09-01T00:00:00.000Z',
      autoDeleteAt: '2026-12-01T00:00:00.000Z',
      revokedAt: null,
      revokedReason: null,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    } as const;

    expect(
      offlinePackageIdsToPurge(
        [
          {
            ...base,
            id: 'ready',
            status: 'READY',
            licenseExpiresAt: '2026-10-01T00:00:00.000Z',
          },
          {
            ...base,
            id: 'revoked',
            status: 'REVOKED',
            licenseExpiresAt: '2026-10-01T00:00:00.000Z',
          },
          {
            ...base,
            id: 'expired-by-time',
            status: 'READY',
            licenseExpiresAt: '2026-09-07T00:00:00.000Z',
          },
        ],
        ['ready', 'revoked', 'expired-by-time', 'missing'],
        now,
      ),
    ).toEqual(['revoked', 'expired-by-time', 'missing']);
  });
});

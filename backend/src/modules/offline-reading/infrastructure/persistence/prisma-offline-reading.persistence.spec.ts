import { OfflinePackageStatus } from '@/generated/prisma/client';

import {
  OfflinePackageNotFoundException,
  OfflinePackageSessionMismatchException,
  OfflinePackageUnavailableException,
} from '../../domain';
import { assertManifestAccessible } from './prisma-offline-reading.persistence';

const NOW = new Date('2026-09-08T12:00:00.000Z');
const PACKAGE_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

describe('offline package manifest access', () => {
  const ready = {
    id: PACKAGE_ID,
    sessionId: SESSION_ID,
    status: OfflinePackageStatus.READY,
    licenseExpiresAt: new Date('2026-10-08T12:00:00.000Z'),
  };

  it('does not reveal whether another user owns a package', () => {
    expect(() =>
      assertManifestAccessible(null, SESSION_ID, NOW, PACKAGE_ID),
    ).toThrow(OfflinePackageNotFoundException);
  });

  it('requires the package-bound session', () => {
    expect(() =>
      assertManifestAccessible(
        ready,
        '33333333-3333-4333-8333-333333333333',
        NOW,
        PACKAGE_ID,
      ),
    ).toThrow(OfflinePackageSessionMismatchException);
  });

  it('rejects expired and revoked packages', () => {
    expect(() =>
      assertManifestAccessible(
        { ...ready, licenseExpiresAt: NOW },
        SESSION_ID,
        NOW,
        PACKAGE_ID,
      ),
    ).toThrow(OfflinePackageUnavailableException);
    expect(() =>
      assertManifestAccessible(
        { ...ready, status: OfflinePackageStatus.REVOKED },
        SESSION_ID,
        NOW,
        PACKAGE_ID,
      ),
    ).toThrow(OfflinePackageUnavailableException);
  });

  it('allows a ready package with a live license in its bound session', () => {
    expect(() =>
      assertManifestAccessible(ready, SESSION_ID, NOW, PACKAGE_ID),
    ).not.toThrow();
  });
});

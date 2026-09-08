import { InvalidOfflinePackageInputException, OfflinePackagePolicy } from '..';

describe('OfflinePackagePolicy', () => {
  it('normalizes package metadata', () => {
    expect(OfflinePackagePolicy.normalizeName('  Bộ   truyện  ')).toBe(
      'Bộ truyện',
    );
    expect(OfflinePackagePolicy.normalizeDescription('  mô tả  ')).toBe(
      'mô tả',
    );
    expect(OfflinePackagePolicy.normalizeDescription('  ')).toBeNull();
  });

  it('rejects empty or duplicate chapter selections', () => {
    expect(() => OfflinePackagePolicy.assertChapterSelection([], 50)).toThrow(
      InvalidOfflinePackageInputException,
    );
    expect(() =>
      OfflinePackagePolicy.assertChapterSelection(['a', 'a'], 50),
    ).toThrow(InvalidOfflinePackageInputException);
  });

  it('enforces package count and total byte quotas', () => {
    const quota = {
      maxPackages: 2,
      maxTotalSizeBytes: 100n,
      maxChaptersPerPackage: 50,
      currentPackages: 2,
      currentSizeBytes: 10n,
    };
    expect(OfflinePackagePolicy.quotaViolation(quota, 1n)).toContain('2 gói');
    expect(
      OfflinePackagePolicy.quotaViolation(
        { ...quota, currentPackages: 1, currentSizeBytes: 90n },
        11n,
      ),
    ).toContain('dung lượng');
  });

  it('uses bounded license and inactivity windows', () => {
    const now = new Date('2026-09-08T00:00:00.000Z');
    expect(OfflinePackagePolicy.licenseExpiresAt(now).toISOString()).toBe(
      '2026-10-08T00:00:00.000Z',
    );
    expect(OfflinePackagePolicy.autoDeleteAt(now).toISOString()).toBe(
      '2026-12-07T00:00:00.000Z',
    );
  });
});

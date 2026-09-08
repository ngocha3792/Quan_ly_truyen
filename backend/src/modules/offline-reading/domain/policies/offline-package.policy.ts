import { InvalidOfflinePackageInputException } from '../exceptions';
import { isUuidV4 } from '@/common/utils';

export interface OfflineQuotaSnapshot {
  readonly maxPackages: number;
  readonly maxTotalSizeBytes: bigint;
  readonly maxChaptersPerPackage: number;
  readonly currentPackages: number;
  readonly currentSizeBytes: bigint;
}

export class OfflinePackagePolicy {
  static readonly DEFAULT_MAX_PACKAGES = 5;
  static readonly DEFAULT_MAX_TOTAL_SIZE_BYTES = 524_288_000n;
  static readonly DEFAULT_MAX_CHAPTERS_PER_PACKAGE = 50;
  static readonly DEFAULT_LICENSE_DURATION_DAYS = 30;
  static readonly INACTIVITY_TTL_DAYS = 90;
  static readonly MAX_NAME_LENGTH = 120;
  static readonly MAX_DESCRIPTION_LENGTH = 500;

  static normalizeName(value: string): string {
    const normalized = value.trim().replace(/\s+/gu, ' ');
    if (!normalized || normalized.length > this.MAX_NAME_LENGTH) {
      throw new InvalidOfflinePackageInputException(
        `Tên gói phải có từ 1 đến ${this.MAX_NAME_LENGTH} ký tự`,
        'name',
      );
    }
    return normalized;
  }

  static normalizeDescription(value: string | undefined): string | null {
    const normalized = value?.trim() ?? '';
    if (normalized.length > this.MAX_DESCRIPTION_LENGTH) {
      throw new InvalidOfflinePackageInputException(
        `Mô tả không được vượt quá ${this.MAX_DESCRIPTION_LENGTH} ký tự`,
        'description',
      );
    }
    return normalized || null;
  }

  static assertChapterSelection(
    chapterIds: readonly string[],
    maxChapters: number,
  ): void {
    if (chapterIds.length === 0) {
      throw new InvalidOfflinePackageInputException(
        'Gói offline phải có ít nhất một chương',
        'chapterIds',
      );
    }
    if (chapterIds.length > maxChapters) {
      throw new InvalidOfflinePackageInputException(
        `Mỗi gói chỉ được chứa tối đa ${maxChapters} chương`,
        'chapterIds',
      );
    }
    if (new Set(chapterIds).size !== chapterIds.length) {
      throw new InvalidOfflinePackageInputException(
        'Danh sách chương không được trùng lặp',
        'chapterIds',
      );
    }
    if (!chapterIds.every(isUuidV4)) {
      throw new InvalidOfflinePackageInputException(
        'Danh sách chương chứa định danh không hợp lệ',
        'chapterIds',
      );
    }
  }

  static quotaViolation(
    quota: OfflineQuotaSnapshot,
    packageSizeBytes: bigint,
  ): string | null {
    if (quota.currentPackages >= quota.maxPackages) {
      return `Bạn đã đạt giới hạn ${quota.maxPackages} gói đọc offline`;
    }
    if (quota.currentSizeBytes + packageSizeBytes > quota.maxTotalSizeBytes) {
      return `Gói mới vượt quá dung lượng offline ${formatBytes(quota.maxTotalSizeBytes)}`;
    }
    return null;
  }

  static licenseExpiresAt(now: Date): Date {
    return addDays(now, this.DEFAULT_LICENSE_DURATION_DAYS);
  }

  static autoDeleteAt(lastAccessedAt: Date): Date {
    return addDays(lastAccessedAt, this.INACTIVITY_TTL_DAYS);
  }
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1_000);
}

function formatBytes(value: bigint): string {
  return `${Math.round(Number(value) / (1024 * 1024))} MB`;
}

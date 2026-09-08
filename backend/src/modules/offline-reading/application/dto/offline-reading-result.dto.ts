import type { ChapterContentDocument } from '@/modules/chapters';

export type OfflinePackageStatusName =
  'PREPARING' | 'READY' | 'EXPIRED' | 'REVOKED';

export interface OfflinePackageSummaryDto {
  readonly id: string;
  readonly deviceId: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly status: OfflinePackageStatusName;
  readonly totalSizeBytes: string;
  readonly chapterCount: number;
  readonly licenseExpiresAt: Date;
  readonly lastAccessedAt: Date;
  readonly autoDeleteAt: Date;
  readonly revokedAt: Date | null;
  readonly revokedReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface OfflineQuotaDto {
  readonly maxPackages: number;
  readonly maxTotalSizeBytes: string;
  readonly maxChaptersPerPackage: number;
  readonly currentPackages: number;
  readonly currentSizeBytes: string;
  readonly remainingPackages: number;
  readonly remainingSizeBytes: string;
}

export interface OfflineChapterMediaSliceDto {
  readonly id: string;
  readonly sliceIndex: number;
  readonly width: number;
  readonly height: number;
  readonly offsetY: number;
  readonly aspectRatio: number;
  readonly urls: {
    readonly avif: string;
    readonly webp: string;
    readonly jpeg: string;
  };
}

export interface OfflineChapterMediaDto {
  readonly mediaAssetId: string;
  readonly sortOrder: number;
  readonly altText: string | null;
  readonly caption: string | null;
  readonly width: number;
  readonly height: number;
  readonly slices: readonly OfflineChapterMediaSliceDto[];
}

export interface OfflineManifestChapterDto {
  readonly chapterId: string;
  readonly story: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
  };
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly chapterVersion: number;
  readonly content: string;
  readonly contentFormat: string;
  readonly contentDocument: ChapterContentDocument;
  readonly documentSchemaVersion: number;
  readonly access: {
    readonly type: 'FREE' | 'PAID';
    readonly state: 'FREE' | 'ENTITLED';
    readonly priceCredits: string | null;
    readonly entitlementId: string | null;
  };
  readonly media: readonly OfflineChapterMediaDto[];
  readonly wordCount: number;
  readonly publishedAt: Date;
  readonly snapshotAt: Date;
}

export interface OfflinePackageManifestDto {
  readonly packageId: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: OfflinePackageStatusName;
  readonly licenseExpiresAt: Date;
  readonly createdAt: Date;
  readonly totalSizeBytes: string;
  readonly chapterCount: number;
  readonly chapters: readonly OfflineManifestChapterDto[];
}

export interface TouchOfflinePackageResultDto {
  readonly lastAccessedAt: Date;
  readonly autoDeleteAt: Date;
}

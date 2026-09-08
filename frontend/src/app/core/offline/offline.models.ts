export type OfflinePackageStatus = 'PREPARING' | 'READY' | 'EXPIRED' | 'REVOKED';

export type OfflinePackageDownloadState = 'DOWNLOADING' | 'READY';

export interface OfflineStorageScope {
  readonly userId: string;
  readonly sessionId: string;
}

export interface OfflineContentMark {
  readonly type: 'bold' | 'italic' | 'code' | 'link';
  readonly from: number;
  readonly to: number;
  readonly href?: string;
}

export interface OfflineContentBlock {
  readonly id: string;
  readonly type: 'paragraph' | 'heading' | 'blockquote' | 'list' | 'code' | 'horizontal_rule';
  readonly text: string;
  readonly marks: readonly OfflineContentMark[];
}

export interface OfflineContentDocument {
  readonly schemaVersion: 1;
  readonly blocks: readonly OfflineContentBlock[];
}

export interface OfflineManifestSlice {
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

export interface OfflineManifestMedia {
  readonly mediaAssetId: string;
  readonly sortOrder: number;
  readonly altText: string | null;
  readonly caption: string | null;
  readonly width: number;
  readonly height: number;
  readonly slices: readonly OfflineManifestSlice[];
}

export interface OfflineManifestChapter {
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
  readonly contentDocument: OfflineContentDocument;
  readonly documentSchemaVersion: number;
  readonly access: {
    readonly type: 'FREE' | 'PAID';
    readonly state: 'FREE' | 'ENTITLED';
    readonly priceCredits: string | null;
    readonly entitlementId: string | null;
  };
  readonly media: readonly OfflineManifestMedia[];
  readonly wordCount: number;
  readonly publishedAt: string;
  readonly snapshotAt: string;
}

export interface OfflinePackageManifest {
  readonly packageId: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: OfflinePackageStatus;
  readonly licenseExpiresAt: string;
  readonly createdAt: string;
  readonly totalSizeBytes: string;
  readonly chapterCount: number;
  readonly chapters: readonly OfflineManifestChapter[];
}

export interface OfflinePackageSummary {
  readonly id: string;
  readonly deviceId: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly status: OfflinePackageStatus;
  readonly totalSizeBytes: string;
  readonly chapterCount: number;
  readonly licenseExpiresAt: string;
  readonly lastAccessedAt: string;
  readonly autoDeleteAt: string;
  readonly revokedAt: string | null;
  readonly revokedReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OfflinePackageRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: OfflinePackageStatus;
  readonly downloadState: OfflinePackageDownloadState;
  readonly licenseExpiresAt: string;
  readonly createdAt: string;
  readonly chapterIds: readonly string[];
  readonly assetUrls: readonly string[];
  readonly chapterCount: number;
  readonly totalSizeBytes: number;
  readonly downloadedBytes: number;
  readonly downloadedAt: string;
  readonly lastAccessedAt: string;
  readonly reservationId: string | null;
  readonly reservationExpiresAt: string | null;
}

export interface OfflineStoredSlice {
  readonly id: string;
  readonly mediaStorageId: string;
  readonly sliceIndex: number;
  readonly width: number;
  readonly height: number;
  readonly offsetY: number;
  readonly aspectRatio: number;
}

export interface OfflineStoredMedia {
  readonly mediaAssetId: string;
  readonly sortOrder: number;
  readonly altText: string | null;
  readonly caption: string | null;
  readonly width: number;
  readonly height: number;
  readonly slices: readonly OfflineStoredSlice[];
}

export interface OfflineChapterRecord {
  readonly packageId: string;
  readonly chapterId: string;
  readonly story: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
  };
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly version: number;
  readonly content: string;
  readonly contentFormat: string;
  readonly contentDocument: OfflineContentDocument;
  readonly documentSchemaVersion: number;
  readonly access: OfflineManifestChapter['access'];
  readonly media: readonly OfflineStoredMedia[];
  readonly wordCount: number;
  readonly publishedAt: string;
  readonly snapshotAt: string;
}

export interface OfflineMediaRecord {
  readonly id: string;
  readonly packageId: string;
  readonly chapterId: string;
  readonly mediaAssetId: string;
  readonly sliceId: string;
  readonly originalUrl: string;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
  readonly sizeBytes: number;
  readonly blob: Blob;
}

export interface OfflineChapterNavigationItem {
  readonly number: number;
  readonly title: string;
  readonly storySlug: string;
}

export interface OfflinePackageEntry {
  readonly storySlug: string;
  readonly chapterNumber: number;
}

export interface OfflineChapterBundle {
  readonly package: OfflinePackageRecord;
  readonly chapter: OfflineChapterRecord;
  readonly media: readonly OfflineMediaRecord[];
  readonly navigation: {
    readonly previous: OfflineChapterNavigationItem | null;
    readonly next: OfflineChapterNavigationItem | null;
  };
}

export interface OfflineProgressInput {
  readonly storyId: string;
  readonly chapterId: string;
  readonly position: number;
  readonly cursor?: OfflineReadingCursor;
  readonly baseRevision: number;
  readonly deviceId: string;
  readonly clientEventId: string;
  readonly lastReadAt?: string;
}

export type OfflineReadingCursor =
  | {
      readonly schemaVersion: 1;
      readonly kind: 'text';
      readonly blockId: string;
      readonly characterOffset: number;
      readonly viewportRatio: number;
    }
  | {
      readonly schemaVersion: 1;
      readonly kind: 'comic';
      readonly mediaAssetId?: string;
      readonly sliceId?: string;
      readonly relativeY: number;
    };

export interface OfflineProgressRecord extends OfflineProgressInput {
  readonly clientEventId: string;
  readonly queuedAt: string;
  readonly attemptCount: number;
}

export type OfflineDownloadPhase = 'preparing' | 'content' | 'media' | 'finalizing';

export interface OfflineDownloadProgress {
  readonly packageId: string;
  readonly phase: OfflineDownloadPhase;
  readonly completed: number;
  readonly total: number;
  readonly percent: number;
}

export interface OfflineDownloadOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: OfflineDownloadProgress) => void;
}

export interface OfflineStorageEstimate {
  readonly usageBytes: number;
  readonly quotaBytes: number;
  readonly offlineBytes: number;
  readonly offlineBudgetBytes: number;
}

export interface OfflineCleanupResult {
  readonly removedPackageIds: readonly string[];
  readonly removedAssetUrls: readonly string[];
  readonly freedBytes: number;
}

export interface OfflineSyncResult {
  readonly synced: number;
  readonly remaining: number;
}

export class OfflineStorageUnavailableError extends Error {
  constructor(message = 'Trình duyệt không hỗ trợ lưu nội dung offline.') {
    super(message);
    this.name = 'OfflineStorageUnavailableError';
  }
}

export class OfflineStorageScopeError extends Error {
  constructor(message = 'Không có phiên đăng nhập hợp lệ cho dữ liệu offline.') {
    super(message);
    this.name = 'OfflineStorageScopeError';
  }
}

export class OfflineQuotaExceededError extends Error {
  constructor(message = 'Không đủ dung lượng để tải gói offline này.') {
    super(message);
    this.name = 'OfflineQuotaExceededError';
  }
}

export class OfflinePackageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OfflinePackageUnavailableError';
  }
}

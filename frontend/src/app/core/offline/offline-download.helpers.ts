import { signal } from '@angular/core';

import type {
  OfflineChapterRecord,
  OfflineDownloadPhase,
  OfflineDownloadProgress,
  OfflineManifestChapter,
  OfflinePackageManifest,
  OfflineStoredMedia,
} from './offline.models';
import { OfflinePackageUnavailableError } from './offline.models';
import { isOfflineLicenseExpired } from './offline-storage.policy';

export function toStoredOfflineChapter(
  packageId: string,
  chapter: OfflineManifestChapter,
  media: readonly OfflineStoredMedia[],
): OfflineChapterRecord {
  return {
    packageId,
    chapterId: chapter.chapterId,
    story: chapter.story,
    number: chapter.number,
    title: chapter.title,
    slug: chapter.slug,
    version: chapter.chapterVersion,
    content: chapter.content,
    contentFormat: chapter.contentFormat,
    contentDocument: chapter.contentDocument,
    documentSchemaVersion: chapter.documentSchemaVersion,
    access: chapter.access,
    media,
    wordCount: chapter.wordCount,
    publishedAt: chapter.publishedAt,
    snapshotAt: chapter.snapshotAt,
  };
}

export function assertOfflineManifestUsable(status: string, licenseExpiresAt: string | null): void {
  if (status !== 'READY') {
    throw new OfflinePackageUnavailableError(
      status === 'EXPIRED'
        ? 'Giấy phép của gói offline đã hết hạn.'
        : status === 'REVOKED'
          ? 'Gói offline đã bị thu hồi.'
          : 'Gói offline chưa sẵn sàng để tải.',
    );
  }
  if (isOfflineLicenseExpired(licenseExpiresAt)) {
    throw new OfflinePackageUnavailableError('Giấy phép của gói offline đã hết hạn.');
  }
}

export function offlineDownloadProgress(
  packageId: string,
  phase: OfflineDownloadPhase,
  completed: number,
  total: number,
): OfflineDownloadProgress {
  return {
    packageId,
    phase,
    completed,
    total,
    percent: total === 0 ? 0 : Math.min(100, (completed / total) * 100),
  };
}

export function selectOfflineSliceAsset(urls: {
  readonly webp: string;
  readonly jpeg: string;
  readonly avif: string;
}): string {
  return urls.webp || urls.jpeg || urls.avif;
}

export async function fetchOfflineAsset(url: string, signal?: AbortSignal): Promise<Blob> {
  const parsed = new URL(url, window.location.origin);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Offline media URL không hợp lệ.');
  }
  const response = await fetch(parsed, {
    cache: 'no-store',
    credentials: 'omit',
    signal,
  });
  if (!response.ok) throw new Error(`Không thể tải offline media: HTTP ${response.status}`);
  return response.blob();
}

export function serializedOfflineSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function offlineMediaMimeType(url: string): string {
  const pathname = new URL(url, window.location.origin).pathname.toLowerCase();
  if (pathname.endsWith('.avif')) return 'image/avif';
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/webp';
}

export function throwIfOfflineDownloadAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Tải offline đã bị hủy.', 'AbortError');
}

export function offlineManifestSnapshotMatches(
  initial: OfflinePackageManifest,
  latest: OfflinePackageManifest,
): boolean {
  if (
    initial.packageId !== latest.packageId ||
    initial.licenseExpiresAt !== latest.licenseExpiresAt ||
    initial.chapters.length !== latest.chapters.length
  ) {
    return false;
  }
  return initial.chapters.every((chapter, index) => {
    const current = latest.chapters[index];
    return (
      current?.chapterId === chapter.chapterId &&
      current.chapterVersion === chapter.chapterVersion &&
      current.snapshotAt === chapter.snapshotAt &&
      current.access.type === chapter.access.type &&
      current.access.state === chapter.access.state &&
      current.access.entitlementId === chapter.access.entitlementId
    );
  });
}

export class OfflineDownloadProgressTracker {
  private readonly state = signal<ReadonlyMap<string, OfflineDownloadProgress>>(new Map());
  readonly progress = this.state.asReadonly();

  update(
    packageId: string,
    value: OfflineDownloadProgress | null,
    callback?: (value: OfflineDownloadProgress) => void,
  ): void {
    this.state.update((current) => {
      const next = new Map(current);
      if (value) next.set(packageId, value);
      else next.delete(packageId);
      return next;
    });
    if (value) callback?.(value);
  }
}

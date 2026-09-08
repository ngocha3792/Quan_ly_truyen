import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { from, map, Observable, of } from 'rxjs';

import { OfflineDownloadService } from '../../../../core/offline/offline-download.service';
import type {
  OfflineChapterBundle,
  OfflineMediaRecord,
} from '../../../../core/offline/offline.models';
import {
  ChapterComicMedia,
  ChapterContentBlock,
  ChapterNavigationItem,
  ChapterReaderView,
} from '../domain/chapter-reader.models';

export interface OfflineChapterReaderResult {
  readonly view: ChapterReaderView;
  readonly packageId: string;
  readonly packageName: string;
  readonly licenseExpiresAt: string | null;
}

@Injectable()
export class ChapterReaderOfflineAdapter {
  private readonly offline = inject(OfflineDownloadService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private activeObjectUrls: string[] = [];
  private readonly pendingObjectUrls = new WeakMap<OfflineChapterReaderResult, string[]>();

  getChapter(
    storySlug: string,
    chapterNumber: string,
  ): Observable<OfflineChapterReaderResult | null> {
    if (!this.browser) return of(null);
    return from(this.offline.getOfflineChapter(storySlug, chapterNumber)).pipe(
      map((bundle) => {
        if (!bundle) return null;
        const objectUrls: string[] = [];
        const result = mapOfflineChapterBundle(bundle, (blob) => {
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          return url;
        });
        this.pendingObjectUrls.set(result, objectUrls);
        return result;
      }),
    );
  }

  adoptAssets(result: OfflineChapterReaderResult): void {
    this.releaseAssets();
    this.activeObjectUrls = this.pendingObjectUrls.get(result) ?? [];
    this.pendingObjectUrls.delete(result);
  }

  discardAssets(result: OfflineChapterReaderResult): void {
    for (const url of this.pendingObjectUrls.get(result) ?? []) URL.revokeObjectURL(url);
    this.pendingObjectUrls.delete(result);
  }

  releaseAssets(): void {
    for (const url of this.activeObjectUrls) URL.revokeObjectURL(url);
    this.activeObjectUrls = [];
  }
}

export function shouldTryOfflineChapter(error: unknown, online: boolean): boolean {
  if (error instanceof HttpErrorResponse) return error.status === 0;
  return !online;
}

export function mapOfflineChapterBundle(
  bundle: OfflineChapterBundle,
  createObjectUrl: (blob: Blob) => string,
): OfflineChapterReaderResult {
  const blocks: readonly ChapterContentBlock[] = bundle.chapter.contentDocument
    ? bundle.chapter.contentDocument.blocks.map((block) => ({
        id: block.id,
        type: block.type,
        text: block.text,
      }))
    : toParagraphs(bundle.chapter.content).map((text) => ({
        id: null,
        type: 'paragraph' as const,
        text,
      }));

  return {
    packageId: bundle.package.id,
    packageName: bundle.package.name,
    licenseExpiresAt: bundle.package.licenseExpiresAt,
    view: {
      story: bundle.chapter.story,
      chapter: {
        id: bundle.chapter.chapterId,
        number: bundle.chapter.number,
        title: bundle.chapter.title,
        paragraphs: toParagraphs(bundle.chapter.content),
        blocks,
        publishedAt: bundle.chapter.publishedAt,
        views: 0,
        accessState: bundle.chapter.access.state,
        priceCredits: bundle.chapter.access.priceCredits,
        media: mapMedia(bundle, createObjectUrl),
      },
      navigation: {
        previous: mapNavigation(bundle.navigation.previous),
        next: mapNavigation(bundle.navigation.next),
      },
      comments: [],
      totalComments: 0,
    },
  };
}

function mapMedia(
  bundle: OfflineChapterBundle,
  createObjectUrl: (blob: Blob) => string,
): readonly ChapterComicMedia[] {
  const storedById = new Map<string, OfflineMediaRecord>(
    bundle.media.map((media) => [media.id, media]),
  );

  return bundle.chapter.media.map((media) => ({
    mediaAssetId: media.mediaAssetId,
    altText: media.altText,
    caption: media.caption,
    width: media.width,
    height: media.height,
    slices: media.slices.flatMap((slice) => {
      const stored = storedById.get(slice.mediaStorageId);
      if (!stored) return [];
      const url = createObjectUrl(stored.blob);
      return [
        {
          id: slice.id,
          sliceIndex: slice.sliceIndex,
          width: slice.width,
          height: slice.height,
          aspectRatio: slice.aspectRatio,
          urls: { avif: url, webp: url, jpeg: url },
        },
      ];
    }),
  }));
}

function mapNavigation(
  item: OfflineChapterBundle['navigation']['previous'],
): ChapterNavigationItem | null {
  if (!item) return null;
  return {
    number: item.number,
    title: item.title,
    url: `/truyen/${item.storySlug}/chuong/${item.number}`,
  };
}

function toParagraphs(content: string): readonly string[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  return normalized
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

import type { Prisma } from '@/generated/prisma/client';
import type { MediaUrlPort } from '@/modules/media';

import type { OfflineChapterMediaDto } from '../../application';

export interface OfflineMediaSource {
  readonly mediaAssetId: string;
  readonly sortOrder: number;
  readonly altText: string | null;
  readonly caption: string | null;
  readonly mediaAsset: {
    readonly publicId: string | null;
    readonly width: number | null;
    readonly height: number | null;
    readonly resourceType: 'IMAGE' | 'VIDEO' | 'RAW' | null;
    readonly deliveryType: string | null;
    readonly sizeBytes: bigint | null;
  };
  readonly slices: readonly {
    readonly id: string;
    readonly sliceIndex: number;
    readonly width: number;
    readonly height: number;
    readonly offsetY: number;
    readonly aspectRatio: { toNumber(): number };
  }[];
}

interface StoredOfflineMediaSlice {
  readonly id: string;
  readonly sliceIndex: number;
  readonly width: number;
  readonly height: number;
  readonly offsetY: number;
  readonly aspectRatio: number;
}

interface StoredOfflineMedia {
  readonly requiresSigning?: boolean;
  readonly mediaAssetId: string;
  readonly publicId: string;
  readonly sortOrder: number;
  readonly altText: string | null;
  readonly caption: string | null;
  readonly width: number;
  readonly height: number;
  readonly sizeBytes: string;
  readonly slices: readonly StoredOfflineMediaSlice[];
}

export interface OfflineMediaSnapshotResult {
  readonly snapshot: Prisma.InputJsonValue;
  readonly mediaCount: number;
  readonly totalSizeBytes: bigint;
  readonly mediaAssetIds: readonly string[];
}

export function createOfflineMediaSnapshot(
  source: readonly OfflineMediaSource[],
  paid: boolean,
): OfflineMediaSnapshotResult {
  const stored = source.flatMap((item): readonly StoredOfflineMedia[] => {
    const { mediaAsset } = item;
    if (
      !mediaAsset.publicId ||
      !mediaAsset.width ||
      !mediaAsset.height ||
      mediaAsset.resourceType !== 'IMAGE' ||
      (paid && mediaAsset.deliveryType !== 'authenticated')
    ) {
      return [];
    }

    const slices = item.slices.length
      ? item.slices.map((slice) => ({
          id: slice.id,
          sliceIndex: slice.sliceIndex,
          width: slice.width,
          height: slice.height,
          offsetY: slice.offsetY,
          aspectRatio: slice.aspectRatio.toNumber(),
        }))
      : [
          {
            id: `${item.mediaAssetId}:full`,
            sliceIndex: 0,
            width: mediaAsset.width,
            height: mediaAsset.height,
            offsetY: 0,
            aspectRatio: mediaAsset.width / mediaAsset.height,
          },
        ];

    return [
      {
        mediaAssetId: item.mediaAssetId,
        requiresSigning: paid || mediaAsset.deliveryType === 'authenticated',
        publicId: mediaAsset.publicId,
        sortOrder: item.sortOrder,
        altText: item.altText,
        caption: item.caption,
        width: mediaAsset.width,
        height: mediaAsset.height,
        sizeBytes: (mediaAsset.sizeBytes ?? 0n).toString(),
        slices,
      },
    ];
  });

  return {
    snapshot: stored as unknown as Prisma.InputJsonValue,
    mediaCount: stored.length,
    totalSizeBytes: stored.reduce(
      (total, media) => total + BigInt(media.sizeBytes),
      0n,
    ),
    mediaAssetIds: stored.map((media) => media.mediaAssetId),
  };
}

export function mapOfflineMediaSnapshot(
  value: unknown,
  accessState: 'FREE' | 'ENTITLED',
  mediaUrl: MediaUrlPort,
): readonly OfflineChapterMediaDto[] {
  return parseStoredMedia(value).map((media) => ({
    mediaAssetId: media.mediaAssetId,
    sortOrder: media.sortOrder,
    altText: media.altText,
    caption: media.caption,
    width: media.width,
    height: media.height,
    slices: media.slices.map((slice) => ({
      ...slice,
      urls: {
        avif: buildUrl(
          mediaUrl,
          media.publicId,
          slice,
          'avif',
          accessState,
          media.requiresSigning,
        ),
        webp: buildUrl(
          mediaUrl,
          media.publicId,
          slice,
          'webp',
          accessState,
          media.requiresSigning,
        ),
        jpeg: buildUrl(
          mediaUrl,
          media.publicId,
          slice,
          'jpg',
          accessState,
          media.requiresSigning,
        ),
      },
    })),
  }));
}

function buildUrl(
  mediaUrl: MediaUrlPort,
  publicId: string,
  slice: StoredOfflineMediaSlice,
  preferredFormat: 'avif' | 'webp' | 'jpg',
  accessState: 'FREE' | 'ENTITLED',
  requiresSigning = false,
): string {
  return mediaUrl.build({
    publicId,
    resourceType: 'image',
    preset: 'chapterImage',
    preferredFormat,
    slice,
    requiresSigning: requiresSigning || accessState === 'ENTITLED',
  });
}

function parseStoredMedia(value: unknown): readonly StoredOfflineMedia[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): readonly StoredOfflineMedia[] => {
    if (
      !isRecord(item) ||
      typeof item.mediaAssetId !== 'string' ||
      typeof item.publicId !== 'string' ||
      typeof item.sortOrder !== 'number' ||
      typeof item.width !== 'number' ||
      typeof item.height !== 'number' ||
      typeof item.sizeBytes !== 'string' ||
      !Array.isArray(item.slices)
    ) {
      return [];
    }
    const slices = item.slices.flatMap(
      (slice): readonly StoredOfflineMediaSlice[] => {
        if (
          !isRecord(slice) ||
          typeof slice.id !== 'string' ||
          typeof slice.sliceIndex !== 'number' ||
          typeof slice.width !== 'number' ||
          typeof slice.height !== 'number' ||
          typeof slice.offsetY !== 'number' ||
          typeof slice.aspectRatio !== 'number'
        ) {
          return [];
        }
        return [slice as unknown as StoredOfflineMediaSlice];
      },
    );
    return [
      {
        mediaAssetId: item.mediaAssetId,
        publicId: item.publicId,
        requiresSigning: item.requiresSigning === true,
        sortOrder: item.sortOrder,
        altText: typeof item.altText === 'string' ? item.altText : null,
        caption: typeof item.caption === 'string' ? item.caption : null,
        width: item.width,
        height: item.height,
        sizeBytes: item.sizeBytes,
        slices,
      },
    ];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

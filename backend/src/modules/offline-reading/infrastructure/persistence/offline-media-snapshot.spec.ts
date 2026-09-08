import type { MediaUrlPort } from '@/modules/media';

import {
  createOfflineMediaSnapshot,
  mapOfflineMediaSnapshot,
  type OfflineMediaSource,
} from './offline-media-snapshot';

function source(deliveryType: string): OfflineMediaSource {
  return {
    mediaAssetId: 'asset-1',
    sortOrder: 0,
    altText: null,
    caption: null,
    mediaAsset: {
      publicId: 'chapter/asset-1',
      width: 800,
      height: 1200,
      resourceType: 'IMAGE',
      deliveryType,
      sizeBytes: 1_024n,
    },
    slices: [],
  };
}

describe('offline media snapshot', () => {
  it('keeps public media for free chapters and filters insecure paid media', () => {
    expect(createOfflineMediaSnapshot([source('upload')], false)).toMatchObject(
      {
        mediaCount: 1,
        totalSizeBytes: 1_024n,
        mediaAssetIds: ['asset-1'],
      },
    );
    expect(createOfflineMediaSnapshot([source('upload')], true)).toEqual({
      snapshot: [],
      mediaCount: 0,
      totalSizeBytes: 0n,
      mediaAssetIds: [],
    });
  });

  it('rebuilds signed delivery URLs from stored metadata', () => {
    const stored = createOfflineMediaSnapshot([source('authenticated')], true);
    const mediaUrl = {
      build: jest.fn(
        (input: { preferredFormat?: string }) =>
          `https://media.test/${input.preferredFormat}`,
      ),
    } as MediaUrlPort;

    const result = mapOfflineMediaSnapshot(
      stored.snapshot,
      'ENTITLED',
      mediaUrl,
    );

    expect(result[0]?.slices[0]?.urls).toEqual({
      avif: 'https://media.test/avif',
      webp: 'https://media.test/webp',
      jpeg: 'https://media.test/jpg',
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mediaUrl.build).toHaveBeenCalledWith(
      expect.objectContaining({ requiresSigning: true }),
    );
  });
});

import { StorageException } from '@/common/exceptions';
import { mapCloudinaryAsset } from './cloudinary-response.mapper';

describe('mapCloudinaryAsset', () => {
  it('maps required authoritative fields', () => {
    expect(
      mapCloudinaryAsset({
        asset_id: 'provider-id',
        public_id: 'asset-id',
        version: 1,
        resource_type: 'raw',
        type: 'upload',
        secure_url: 'https://res.cloudinary.com/test/raw/upload/asset-id.pdf',
        bytes: 12,
      }),
    ).toMatchObject({
      providerAssetId: 'provider-id',
      publicId: 'asset-id',
      resourceType: 'raw',
      bytes: 12,
    });
  });
  it.each([
    { public_id: 'x' },
    {
      asset_id: 'x',
      public_id: 'y',
      version: 1,
      resource_type: 'fetch',
      type: 'upload',
      secure_url: 'https://x',
      bytes: 1,
    },
    {
      asset_id: 'x',
      public_id: 'y',
      version: 1,
      resource_type: 'image',
      type: 'upload',
      secure_url: 'http://x',
      bytes: 1,
    },
  ])('rejects incomplete or invalid provider payload', (payload) =>
    expect(() => mapCloudinaryAsset(payload)).toThrow(StorageException),
  );
});

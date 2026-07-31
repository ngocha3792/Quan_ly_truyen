import type { UploadApiResponse } from 'cloudinary';

import type { StoredMedia } from '../contracts/stored-media.interface';

export function mapCloudinaryAsset(asset: UploadApiResponse): StoredMedia {
  return {
    provider: 'cloudinary',
    providerAssetId: asset.asset_id,
    publicId: asset.public_id,
    version: asset.version,
    resourceType: asset.resource_type as 'image' | 'video' | 'raw',
    deliveryType: asset.type,
    format: asset.format,
    assetFolder: asset.asset_folder,
    secureUrl: asset.secure_url,
    bytes: asset.bytes,
    width: asset.width,
    height: asset.height,
    duration:
      typeof asset.duration === 'number' ? asset.duration : undefined,
    originalFilename: asset.original_filename,
  };
}

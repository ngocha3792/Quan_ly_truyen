import type { MediaStorageResourceType } from '../../domain/value-objects/media-storage-resource-type';

export type { MediaStorageResourceType } from '../../domain/value-objects/media-storage-resource-type';

export interface StoredMedia {
  provider: 'cloudinary';

  providerAssetId: string;
  publicId: string;
  version: number;

  resourceType: MediaStorageResourceType;
  deliveryType: string;
  format?: string;
  assetFolder?: string;

  secureUrl: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;

  originalFilename?: string;
}

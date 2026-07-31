export interface StoredMedia {
  provider: 'cloudinary';

  providerAssetId: string;
  publicId: string;
  version: number;

  resourceType: 'image' | 'video' | 'raw';
  deliveryType: string;
  format: string;
  assetFolder?: string;

  secureUrl: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;

  originalFilename?: string;
}

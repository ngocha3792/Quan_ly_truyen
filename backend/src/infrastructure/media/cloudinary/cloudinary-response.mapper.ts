import { StorageException } from '@/common/exceptions';
import type {
  MediaStorageResourceType,
  StoredMedia,
} from '../contracts/stored-media.interface';

export function mapCloudinaryAsset(value: unknown): StoredMedia {
  if (!value || typeof value !== 'object') throw invalidResponse();
  const asset = value as Record<string, unknown>;
  const providerAssetId = requiredString(asset.asset_id);
  const publicId = requiredString(asset.public_id);
  const version = requiredPositiveInteger(asset.version);
  const resourceType = toResourceType(asset.resource_type);
  const deliveryType = requiredString(asset.type);
  const secureUrl = requiredString(asset.secure_url);
  const bytes = requiredPositiveInteger(asset.bytes);
  if (!secureUrl.startsWith('https://')) throw invalidResponse();
  return {
    provider: 'cloudinary',
    providerAssetId,
    publicId,
    version,
    resourceType,
    deliveryType,
    format: optionalString(asset.format),
    assetFolder: optionalString(asset.asset_folder),
    secureUrl,
    bytes,
    width: optionalNumber(asset.width),
    height: optionalNumber(asset.height),
    duration: optionalNumber(asset.duration),
    originalFilename: optionalString(asset.original_filename),
  };
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value) throw invalidResponse();
  return value;
}
function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
function requiredPositiveInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
    throw invalidResponse();
  return value;
}
function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}
function toResourceType(value: unknown): MediaStorageResourceType {
  if (value === 'image' || value === 'video' || value === 'raw') return value;
  throw invalidResponse();
}
function invalidResponse(): StorageException {
  return new StorageException({
    provider: 'cloudinary',
    operation: 'map-response',
    message: 'Cloudinary trả dữ liệu asset không đầy đủ hoặc không hợp lệ',
    retryable: false,
  });
}

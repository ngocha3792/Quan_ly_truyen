import {
  InvalidInputException,
  UnsupportedMediaTypeException,
} from '@/common/exceptions';
import type { MediaUploadPolicy } from './media-upload-policy.registry';
import { MEDIA_ERROR_CODES } from '../exceptions/media-error-codes';

export class MediaPublicIdPolicy {
  getExtension(originalName: string, policy: MediaUploadPolicy): string {
    if (
      !originalName ||
      originalName.includes('\0') ||
      /[\\/]/.test(originalName) ||
      originalName.includes('..')
    ) {
      throw new InvalidInputException({
        code: MEDIA_ERROR_CODES.POLICY_VIOLATION,
        message: 'Tên tệp không hợp lệ',
      });
    }
    const dot = originalName.lastIndexOf('.');
    const extension = dot > 0 ? originalName.slice(dot + 1).toLowerCase() : '';
    if (
      !extension ||
      !/^[a-z0-9]+$/.test(extension) ||
      !policy.allowedFormats.includes(extension)
    ) {
      throw new UnsupportedMediaTypeException({
        received: extension || undefined,
        supported: policy.allowedFormats,
      });
    }
    return extension;
  }

  build(
    mediaAssetId: string,
    originalName: string,
    policy: MediaUploadPolicy,
  ): string {
    const extension = this.getExtension(originalName, policy);
    return policy.resourceType === 'raw'
      ? `${mediaAssetId}.${extension}`
      : mediaAssetId;
  }
}

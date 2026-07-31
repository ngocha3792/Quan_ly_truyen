import { AppException, ExceptionCategory } from '@/common/exceptions';
import { MEDIA_ERROR_CODES } from './media-error-codes';

export class MediaStorageDisabledException extends AppException {
  constructor(message = 'Dịch vụ lưu trữ media đang bị tắt') {
    super({
      code: MEDIA_ERROR_CODES.STORAGE_DISABLED,
      message,
      category: ExceptionCategory.SERVICE_UNAVAILABLE,
      retryable: false,
    });
  }
}

export class CloudinaryWebhookSignatureException extends AppException {
  constructor() {
    super({
      code: MEDIA_ERROR_CODES.WEBHOOK_SIGNATURE_INVALID,
      message: 'Chữ ký Cloudinary webhook không hợp lệ',
      category: ExceptionCategory.UNAUTHORIZED,
      retryable: false,
    });
  }
}

import {
  BusinessRuleViolationException,
  ExternalServiceException,
  InvalidInputException,
  ResourceNotFoundException,
} from '@/common/exceptions';

export class OcrInvalidInputException extends InvalidInputException {
  constructor(message: string, field?: string) {
    super({
      code: 'OCR_INPUT_INVALID',
      message,
      ...(field ? { details: { field } } : {}),
    });
  }
}

export class OcrChapterNotFoundException extends ResourceNotFoundException {
  constructor(id: string) {
    super({
      code: 'OCR_CHAPTER_NOT_FOUND',
      resource: 'Chương truyện tranh',
      identifier: id,
    });
  }
}

export class OcrPagesMissingException extends BusinessRuleViolationException {
  constructor() {
    super({
      code: 'OCR_PAGES_MISSING',
      message: 'Chương này chưa có trang ảnh nào để nhận dạng',
    });
  }
}

/**
 * `retryable` distinguishes a recognition host that is merely busy or briefly
 * unreachable from one that rejected the request outright, so the queue does
 * not burn its attempts replaying a request that can never succeed.
 */
export class OcrProviderException extends ExternalServiceException {
  constructor(
    message: string,
    readonly retryable = true,
  ) {
    super({
      service: 'Dịch vụ OCR',
      code: 'OCR_PROVIDER_FAILED',
      message,
    });
  }
}

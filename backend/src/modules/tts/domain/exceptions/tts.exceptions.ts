import {
  AccessDeniedException,
  BusinessRuleViolationException,
  ExternalServiceException,
  InvalidInputException,
  ResourceNotFoundException,
} from '@/common/exceptions';

export class TtsInvalidInputException extends InvalidInputException {
  constructor(message: string, field?: string) {
    super({
      code: 'TTS_INPUT_INVALID',
      message,
      ...(field ? { details: { field } } : {}),
    });
  }
}

export class TtsManifestNotFoundException extends ResourceNotFoundException {
  constructor(id: string) {
    super({
      code: 'TTS_MANIFEST_NOT_FOUND',
      resource: 'TTS manifest',
      identifier: id,
    });
  }
}

export class TtsConnectionNotFoundException extends ResourceNotFoundException {
  constructor(id: string) {
    super({
      code: 'TTS_CONNECTION_NOT_FOUND',
      resource: 'TTS connection',
      identifier: id,
    });
  }
}

export class TtsChapterAccessDeniedException extends AccessDeniedException {
  constructor() {
    super({
      code: 'TTS_CHAPTER_ACCESS_DENIED',
      message: 'Bạn không có quyền tạo hoặc nghe audio cho chương này',
    });
  }
}

export class TtsQuotaExceededException extends BusinessRuleViolationException {
  constructor(limit: number, used: number) {
    super({
      code: 'TTS_QUOTA_EXCEEDED',
      message: 'Bạn đã vượt quota ký tự TTS trong tháng',
      rule: 'tts_monthly_character_quota',
      details: { limit, used },
    });
  }
}

export class TtsProviderException extends ExternalServiceException {
  constructor(message: string, retryable = true) {
    super({
      service: 'TTS provider',
      code: 'TTS_PROVIDER_FAILED',
      message,
      retryable,
    });
  }
}

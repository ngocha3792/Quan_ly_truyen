import {
  AccessDeniedException,
  BusinessRuleViolationException,
  InvalidInputException,
  ResourceNotFoundException,
} from '@/common/exceptions';

export class InvalidOfflinePackageInputException extends InvalidInputException {
  constructor(message: string, field?: string) {
    super({
      code: 'OFFLINE_PACKAGE_INPUT_INVALID',
      message,
      ...(field ? { details: { field } } : {}),
    });
  }
}

export class OfflineQuotaExceededException extends BusinessRuleViolationException {
  constructor(message: string) {
    super({
      code: 'OFFLINE_QUOTA_EXCEEDED',
      message,
      rule: 'offline_package_must_fit_user_quota',
    });
  }
}

export class OfflineChapterUnavailableException extends BusinessRuleViolationException {
  constructor(chapterId: string, reason: string) {
    super({
      code: 'OFFLINE_CHAPTER_UNAVAILABLE',
      message: reason,
      rule: 'offline_chapter_must_be_published_and_entitled',
      details: { chapterId },
    });
  }
}

export class OfflinePackageNotFoundException extends ResourceNotFoundException {
  constructor(packageId: string) {
    super({
      code: 'OFFLINE_PACKAGE_NOT_FOUND',
      resource: 'gói đọc offline',
      identifier: packageId,
    });
  }
}

export class OfflinePackageSessionMismatchException extends AccessDeniedException {
  constructor() {
    super({
      code: 'OFFLINE_PACKAGE_SESSION_MISMATCH',
      message: 'Gói đọc offline không thuộc phiên đăng nhập hiện tại',
    });
  }
}

export class OfflinePackageUnavailableException extends BusinessRuleViolationException {
  constructor(status: string) {
    super({
      code: 'OFFLINE_PACKAGE_UNAVAILABLE',
      message:
        status === 'EXPIRED'
          ? 'Giấy phép của gói đọc offline đã hết hạn'
          : 'Gói đọc offline đã bị thu hồi',
      rule: 'offline_package_must_be_ready_and_licensed',
      details: { status },
    });
  }
}

import {
  BusinessRuleViolationException,
  InvalidInputException,
  ResourceConflictException,
  ResourceNotFoundException,
} from '@/common/exceptions';

export class MonetizationResourceNotFoundException extends ResourceNotFoundException {
  constructor(resource: string, identifier?: string) {
    super({
      code: 'MONETIZATION_RESOURCE_NOT_FOUND',
      resource,
      ...(identifier ? { identifier } : {}),
    });
  }
}

export class InvalidMonetizationInputException extends InvalidInputException {
  constructor(message: string, field?: string) {
    super({
      code: 'MONETIZATION_INPUT_INVALID',
      message,
      ...(field ? { details: { field } } : {}),
    });
  }
}

export class ChapterAlreadyOwnedException extends ResourceConflictException {
  constructor(chapterId: string) {
    super({
      code: 'CHAPTER_ALREADY_OWNED',
      message: 'Tài khoản đã sở hữu quyền đọc chương này',
      resource: 'chapter entitlement',
      value: chapterId,
    });
  }
}

export class ChapterNotPurchasableException extends BusinessRuleViolationException {
  constructor(message = 'Chương hiện không thể mua') {
    super({
      code: 'CHAPTER_NOT_PURCHASABLE',
      message,
      rule: 'chapter_must_have_active_paid_pricing',
    });
  }
}

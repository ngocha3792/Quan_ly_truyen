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

export class ChapterPurchaseNotRefundableException extends BusinessRuleViolationException {
  constructor(status: string) {
    super({
      code: 'CHAPTER_PURCHASE_NOT_REFUNDABLE',
      message: `Giao dịch mua chương ở trạng thái ${status} không thể hoàn`,
      rule: 'only_completed_chapter_purchase_can_be_refunded',
      details: { status },
    });
  }
}

export class MonetizationRolloutRestrictedException extends BusinessRuleViolationException {
  constructor() {
    super({
      code: 'MONETIZATION_ROLLOUT_RESTRICTED',
      message:
        'Tính năng mua chương chưa được mở cho tài khoản hoặc truyện này',
      rule: 'account_or_story_must_be_in_monetization_rollout',
    });
  }
}

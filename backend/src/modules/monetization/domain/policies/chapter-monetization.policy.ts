import { isUuidV4 } from '@/common/utils';
import { AuthenticationRequiredException } from '@/common/exceptions';

import { InvalidMonetizationInputException } from '../exceptions';
import {
  assertEarlyAccessPricingInput,
  type ChapterPricingAccess,
} from './chapter-pricing-access.policy';
import {
  LOCKED_CHAPTER_PREVIEW_MAX_CHARS,
  MAX_CHAPTER_PRICE_CREDITS,
  type ChapterAccessTypeName,
} from '../enums';

export function assertSetChapterPricingInput(
  input: ChapterPricingAccess & {
    actorId: string;
    storyId: string;
    chapterId: string;
    accessType: ChapterAccessTypeName;
    priceBandId?: string;
  },
): void {
  assertEarlyAccessPricingInput(input);
  for (const [field, value] of [
    ['actorId', input.actorId],
    ['storyId', input.storyId],
    ['chapterId', input.chapterId],
  ] as const) {
    if (!isUuidV4(value)) {
      throw new InvalidMonetizationInputException(
        `${field} không hợp lệ`,
        field,
      );
    }
  }

  if (input.accessType === 'PAID') {
    if (!input.priceBandId || !isUuidV4(input.priceBandId)) {
      throw new InvalidMonetizationInputException(
        'Chương trả phí phải chọn một price band hợp lệ',
        'priceBandId',
      );
    }
  } else if (input.priceBandId) {
    throw new InvalidMonetizationInputException(
      'Chương miễn phí không được gắn price band',
      'priceBandId',
    );
  }
}

export function assertUnlockChapterInput(input: {
  userId: string;
  chapterId: string;
  idempotencyKey: string;
}): void {
  if (!isUuidV4(input.userId)) {
    throw new InvalidMonetizationInputException(
      'Tài khoản không hợp lệ',
      'userId',
    );
  }
  if (!isUuidV4(input.chapterId)) {
    throw new InvalidMonetizationInputException(
      'Chương không hợp lệ',
      'chapterId',
    );
  }
  const length = input.idempotencyKey.trim().length;
  if (length < 8 || length > 200) {
    throw new InvalidMonetizationInputException(
      'Idempotency key phải có độ dài từ 8 đến 200 ký tự',
      'idempotencyKey',
    );
  }
}

export function assertRefundChapterPurchaseInput(input: {
  actorId: string;
  purchaseId: string;
  reason: string;
}): void {
  if (!isUuidV4(input.actorId)) {
    throw new InvalidMonetizationInputException(
      'Quản trị viên không hợp lệ',
      'actorId',
    );
  }
  if (!isUuidV4(input.purchaseId)) {
    throw new InvalidMonetizationInputException(
      'Giao dịch mua chương không hợp lệ',
      'purchaseId',
    );
  }
  const reasonLength = input.reason.trim().length;
  if (reasonLength < 10 || reasonLength > 500) {
    throw new InvalidMonetizationInputException(
      'Lý do hoàn phải có độ dài từ 10 đến 500 ký tự',
      'reason',
    );
  }
}

export function assertCreditPrice(price: bigint): void {
  if (price <= 0n || price > MAX_CHAPTER_PRICE_CREDITS) {
    throw new InvalidMonetizationInputException(
      `Giá Credit phải từ 1 đến ${MAX_CHAPTER_PRICE_CREDITS.toString()}`,
      'creditPrice',
    );
  }
}

export function requireMonetizationUserId(userId: string | undefined): string {
  if (!userId) {
    throw new AuthenticationRequiredException({
      message: 'Bạn cần đăng nhập để sử dụng tính năng Credit',
    });
  }
  return userId;
}

export function buildServerControlledPreview(content: string): string {
  const normalized = content.replace(/\r\n/gu, '\n').trim();
  if (normalized.length <= 1) {
    throw new InvalidMonetizationInputException(
      'Nội dung chương quá ngắn để tạo preview an toàn',
      'content',
    );
  }

  const tenPercent = Math.max(1, Math.floor(normalized.length * 0.1));
  const previewLength = Math.min(
    normalized.length - 1,
    LOCKED_CHAPTER_PREVIEW_MAX_CHARS,
    Math.max(200, tenPercent),
  );
  return normalized.slice(0, previewLength).trimEnd();
}

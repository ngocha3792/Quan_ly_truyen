import { InvalidMonetizationInputException } from '../exceptions';

export interface ChapterPricingAccess {
  readonly accessType: 'FREE' | 'PAID';
  readonly unlockPolicy?: 'PERMANENT_PAID' | 'EARLY_ACCESS';
  readonly freeAt?: Date | null;
  readonly paidWindowDays?: number | null;
}

/** A day is an elapsed 24 hours, independent of server timezone or DST. */
export function resolveChapterFreeAt(
  pricing: ChapterPricingAccess | null | undefined,
  publishedAt: Date | null | undefined,
): Date | null {
  if (pricing?.accessType !== 'PAID' || pricing.unlockPolicy !== 'EARLY_ACCESS')
    return null;
  if (pricing.freeAt)
    return Number.isFinite(pricing.freeAt.getTime()) ? pricing.freeAt : null;
  const days = pricing.paidWindowDays;
  if (!publishedAt || !days || !Number.isInteger(days) || days < 1) return null;
  const deadline = new Date(publishedAt.getTime() + days * 86_400_000);
  return Number.isFinite(deadline.getTime()) ? deadline : null;
}

/** Invalid/missing early-access dates fail closed; stored pricing is never changed. */
export function isChapterEffectivelyFree(
  pricing: ChapterPricingAccess | null | undefined,
  publishedAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!pricing || pricing.accessType === 'FREE') return true;
  const freeAt = resolveChapterFreeAt(pricing, publishedAt);
  return freeAt !== null && now.getTime() >= freeAt.getTime();
}

export function assertEarlyAccessPricingInput(
  input: ChapterPricingAccess,
): void {
  const hasDate = input.freeAt !== undefined && input.freeAt !== null;
  const hasDays =
    input.paidWindowDays !== undefined && input.paidWindowDays !== null;
  if (input.unlockPolicy !== 'EARLY_ACCESS') {
    if (hasDate || hasDays)
      throw new InvalidMonetizationInputException(
        'Lịch mở miễn phí chỉ dùng cho chế độ đọc sớm',
        'unlockPolicy',
      );
    return;
  }
  if (input.accessType !== 'PAID')
    throw new InvalidMonetizationInputException(
      'Chỉ chương trả phí mới được bật đọc sớm',
      'accessType',
    );
  if (hasDate === hasDays)
    throw new InvalidMonetizationInputException(
      'Chọn đúng một mốc mở miễn phí hoặc số ngày đọc sớm',
      'freeAt',
    );
  if (hasDate && !Number.isFinite(input.freeAt.getTime()))
    throw new InvalidMonetizationInputException(
      'Mốc mở miễn phí không hợp lệ',
      'freeAt',
    );
  if (
    hasDays &&
    (!Number.isInteger(input.paidWindowDays) ||
      input.paidWindowDays < 1 ||
      input.paidWindowDays > 3650)
  )
    throw new InvalidMonetizationInputException(
      'Số ngày đọc sớm phải từ 1 đến 3650',
      'paidWindowDays',
    );
}

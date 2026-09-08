export interface OfflineChapterAccessCheck {
  readonly accessType: 'FREE' | 'PAID';
  readonly priceCredits: bigint | null;
  readonly entitlementId: string | null;
  readonly entitlementStatus: 'ACTIVE' | 'REVOKED' | null;
}

export type OfflineChapterAccessDecision =
  | {
      readonly allowed: true;
      readonly accessState: 'FREE' | 'ENTITLED';
      readonly entitlementId: string | null;
      readonly priceCredits: bigint | null;
    }
  | {
      readonly allowed: false;
      readonly reason: string;
    };

export class OfflineEntitlementPolicy {
  static verify(
    input: OfflineChapterAccessCheck,
  ): OfflineChapterAccessDecision {
    if (input.accessType === 'FREE') {
      return {
        allowed: true,
        accessState: 'FREE',
        entitlementId: null,
        priceCredits: null,
      };
    }

    if (!input.priceCredits || input.priceCredits <= 0n) {
      return {
        allowed: false,
        reason: 'Cấu hình giá của chương không hợp lệ',
      };
    }

    if (!input.entitlementId || input.entitlementStatus !== 'ACTIVE') {
      return {
        allowed: false,
        reason: 'Bạn chưa có quyền đọc chương trả phí này',
      };
    }

    return {
      allowed: true,
      accessState: 'ENTITLED',
      entitlementId: input.entitlementId,
      priceCredits: input.priceCredits,
    };
  }
}

import { OfflineEntitlementPolicy } from './offline-entitlement.policy';

describe('OfflineEntitlementPolicy', () => {
  it('allows free chapters without an entitlement', () => {
    expect(
      OfflineEntitlementPolicy.verify({
        accessType: 'FREE',
        priceCredits: null,
        entitlementId: null,
        entitlementStatus: null,
      }),
    ).toEqual({
      allowed: true,
      accessState: 'FREE',
      entitlementId: null,
      priceCredits: null,
    });
  });

  it('allows paid chapters only with an active entitlement', () => {
    expect(
      OfflineEntitlementPolicy.verify({
        accessType: 'PAID',
        priceCredits: 12n,
        entitlementId: 'entitlement-1',
        entitlementStatus: 'ACTIVE',
      }),
    ).toEqual({
      allowed: true,
      accessState: 'ENTITLED',
      entitlementId: 'entitlement-1',
      priceCredits: 12n,
    });

    expect(
      OfflineEntitlementPolicy.verify({
        accessType: 'PAID',
        priceCredits: 12n,
        entitlementId: null,
        entitlementStatus: null,
      }),
    ).toEqual({
      allowed: false,
      reason: 'Bạn chưa có quyền đọc chương trả phí này',
    });
  });

  it('fails closed for corrupt paid pricing', () => {
    expect(
      OfflineEntitlementPolicy.verify({
        accessType: 'PAID',
        priceCredits: null,
        entitlementId: 'entitlement-1',
        entitlementStatus: 'ACTIVE',
      }),
    ).toEqual({
      allowed: false,
      reason: 'Cấu hình giá của chương không hợp lệ',
    });
  });
});

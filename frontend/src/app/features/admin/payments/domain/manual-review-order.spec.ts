import { isOverdue, reference } from './manual-review-order';
import { ManualReviewOrder } from './admin-payment.models';

function order(overrides: Partial<ManualReviewOrder> = {}): ManualReviewOrder {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userEmail: 'reader@test.invalid',
    userDisplayName: 'Trần Minh Khang',
    packageLabel: 'Gói 500 Credit',
    provider: 'vietcombank',
    providerReference: 'CK240924-001',
    creditAmount: '500',
    fiatAmountMinor: '2500000',
    currency: 'VND',
    status: 'AWAITING_REVIEW',
    transferClaim: null,
    createdAt: new Date().toISOString(),
    settledAt: null,
    ...overrides,
  };
}

describe('isOverdue', () => {
  it('đánh dấu đơn chờ duyệt đã quá 24 giờ', () => {
    const createdAt = new Date(Date.now() - 25 * 3_600_000).toISOString();

    expect(isOverdue(order({ createdAt }))).toBe(true);
  });

  it('không đánh dấu đơn vừa gửi', () => {
    expect(isOverdue(order())).toBe(false);
  });

  // Đơn đã chốt thì không còn là việc tồn đọng, dù nó cũ đến đâu.
  it('bỏ qua đơn không còn chờ duyệt', () => {
    const createdAt = new Date(Date.now() - 400 * 3_600_000).toISOString();

    expect(isOverdue(order({ createdAt, status: 'PAID' }))).toBe(false);
  });

  it('không vỡ khi thời gian gửi không đọc được', () => {
    expect(isOverdue(order({ createdAt: 'không-phải-ngày' }))).toBe(false);
  });
});

describe('reference', () => {
  it('ưu tiên mã người gửi tự khai vì đó là mã họ ghi trên uỷ nhiệm chi', () => {
    expect(reference(order({ transferClaim: { referenceCode: '  FT24268123456  ' } }))).toBe(
      'FT24268123456',
    );
  });

  it('dùng mã của cổng khi người gửi không khai', () => {
    expect(reference(order())).toBe('CK240924-001');
  });

  it('rơi về tiền tố ID đơn khi không có mã nào', () => {
    expect(reference(order({ providerReference: null, transferClaim: { note: 'nạp' } }))).toBe(
      '11111111',
    );
  });
});

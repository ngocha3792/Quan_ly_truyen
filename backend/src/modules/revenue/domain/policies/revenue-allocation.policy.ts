import { InvalidInputException } from '@/common/exceptions';

export interface RevenueShare {
  readonly userId: string;
  readonly type: 'AUTHOR_SHARE' | 'PLATFORM_FEE' | 'CONTRIBUTOR';
  readonly basisPoints: number;
}

/** Integer Credit arithmetic. Residual Credits go to the author first, then contributors, so platform fee never gains rounding value. */
export function distributeRevenue(
  gross: bigint,
  shares: readonly RevenueShare[],
) {
  if (
    gross <= 0n ||
    gross > 9_000_000_000_000_000n ||
    shares.length < 2 ||
    shares.length > 18 ||
    shares.some(
      (share) =>
        !Number.isInteger(share.basisPoints) ||
        share.basisPoints < 0 ||
        share.basisPoints > 10000,
    ) ||
    shares.reduce((sum, share) => sum + share.basisPoints, 0) !== 10000 ||
    new Set(shares.map((share) => share.userId)).size !== shares.length
  ) {
    throw new InvalidInputException({
      code: 'REVENUE_SHARES_INVALID',
      message:
        'Tổng tỷ lệ phải bằng 100%, mỗi người nhận chỉ xuất hiện một lần.',
    });
  }
  const rows = shares.map((share) => ({
    ...share,
    amount: (gross * BigInt(share.basisPoints)) / 10000n,
    remainder: (gross * BigInt(share.basisPoints)) % 10000n,
  }));
  const ranked = rows
    .filter((row) => row.basisPoints > 0)
    .sort((a, b) => {
      const priority = (type: RevenueShare['type']) =>
        type === 'AUTHOR_SHARE' ? 0 : type === 'CONTRIBUTOR' ? 1 : 2;
      const byType = priority(a.type) - priority(b.type);
      if (byType !== 0) return byType;
      if (b.remainder !== a.remainder)
        return b.remainder > a.remainder ? 1 : -1;
      return a.userId.localeCompare(b.userId);
    });
  const remaining = gross - rows.reduce((sum, row) => sum + row.amount, 0n);
  for (let index = 0; index < Number(remaining); index++)
    ranked[index].amount += 1n;
  return rows.map((row) => ({
    userId: row.userId,
    type: row.type,
    basisPoints: row.basisPoints,
    amount: row.amount,
  }));
}

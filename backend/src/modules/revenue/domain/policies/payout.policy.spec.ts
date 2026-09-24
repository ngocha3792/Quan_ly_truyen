import { calculatePayoutAmounts, reserveEarningParts } from './payout.policy';

describe('payout amounts and immutable earning reservations', () => {
  const policy = {
    minimumPayoutCredits: '100',
    feeBasisPoints: 500,
    taxBasisPoints: 1000,
    fiatMinorPerCredit: '1000',
  };
  it('balances integer credit fees and tax then converts only net payout', () => {
    expect(calculatePayoutAmounts(101n, policy)).toEqual({
      gross: 101n,
      fee: 5n,
      tax: 10n,
      net: 86n,
      fiatAmountMinor: 86_000n,
    });
  });
  it('rejects minimum, invalid fee totals, disabled conversion and database overflow', () => {
    expect(() => calculatePayoutAmounts(99n, policy)).toThrow('PAYOUT_MINIMUM');
    expect(() =>
      calculatePayoutAmounts(100n, { ...policy, taxBasisPoints: 9500 }),
    ).toThrow('PAYOUT_POLICY_INVALID');
    expect(() =>
      calculatePayoutAmounts(100n, { ...policy, fiatMinorPerCredit: '0' }),
    ).toThrow('PAYOUT_POLICY_INVALID');
    expect(() =>
      calculatePayoutAmounts(99_999_999_999_999_999n, policy),
    ).toThrow('PAYOUT_AMOUNT_TOO_LARGE');
  });
  it('reserves part of a ledger row without changing its immutable amount', () => {
    const entries = [{ id: 'a', amount: 1000n, reservedAmount: 100n }];
    expect(reserveEarningParts(entries, 250n)).toEqual([
      { earningId: 'a', amount: 250n },
    ]);
    expect(entries[0].amount).toBe(1000n);
  });
  it('accepts the maximum credit amount but rejects one credit above the limit', () => {
    const noFees = {
      ...policy,
      feeBasisPoints: 0,
      taxBasisPoints: 0,
      fiatMinorPerCredit: '1',
    };
    expect(calculatePayoutAmounts(9_000_000_000_000_000n, noFees).gross).toBe(
      9_000_000_000_000_000n,
    );
    expect(() =>
      calculatePayoutAmounts(9_000_000_000_000_001n, noFees),
    ).toThrow('PAYOUT_AMOUNT_TOO_LARGE');
  });
  it('checks the converted net payout against PostgreSQL signed bigint bounds', () => {
    const maximumRate = {
      ...policy,
      feeBasisPoints: 0,
      taxBasisPoints: 0,
      fiatMinorPerCredit: '1000000',
    };
    expect(
      calculatePayoutAmounts(9_223_372_036_854n, maximumRate).fiatAmountMinor,
    ).toBe(9_223_372_036_854_000_000n);
    expect(() =>
      calculatePayoutAmounts(9_223_372_036_855n, maximumRate),
    ).toThrow('PAYOUT_AMOUNT_TOO_LARGE');
    expect(() =>
      calculatePayoutAmounts(100n, {
        ...maximumRate,
        fiatMinorPerCredit: '1000001',
      }),
    ).toThrow('PAYOUT_POLICY_INVALID');
  });
  it('deducts active and paid reservations before selecting available parts', () => {
    expect(
      reserveEarningParts(
        [
          { id: 'a', amount: 200n, reservedAmount: 180n },
          { id: 'b', amount: 100n, reservedAmount: 0n },
        ],
        100n,
      ),
    ).toEqual([
      { earningId: 'a', amount: 20n },
      { earningId: 'b', amount: 80n },
    ]);
  });
  it('includes refund debt and prevents using positive entries to bypass it', () => {
    const entries = [
      { id: 'debt', amount: -80n, reservedAmount: 0n },
      { id: 'credit', amount: 200n, reservedAmount: 0n },
    ];
    expect(() => reserveEarningParts(entries, 121n)).toThrow(
      'PAYOUT_INSUFFICIENT_EARNINGS',
    );
    expect(reserveEarningParts(entries, 120n)).toEqual([
      { earningId: 'credit', amount: 120n },
    ]);
  });
  it('does not reserve a previously consumed or negative earning row', () => {
    expect(() =>
      reserveEarningParts(
        [{ id: 'spent', amount: 100n, reservedAmount: 100n }],
        1n,
      ),
    ).toThrow('PAYOUT_INSUFFICIENT_EARNINGS');
  });
});

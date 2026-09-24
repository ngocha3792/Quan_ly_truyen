import { quotePayout } from './revenue.models';

describe('revenue policy calculations', () => {
  const policy = {
    enabled: true,
    version: 1,
    settlementDelayDays: 7,
    minimumPayoutCredits: '100',
    feeBasisPoints: 500,
    taxBasisPoints: 1000,
    fiatMinorPerCredit: '2500',
    minimumPlatformFeeBasisPoints: 3000,
    platformUserId: null,
    currency: 'VND' as const,
  };

  it('calculates fee, tax and fiat payout with integer arithmetic', () => {
    expect(quotePayout('1001', policy)).toEqual({
      gross: '1001',
      fee: '50',
      tax: '100',
      net: '851',
      vnd: '2127500',
    });
  });

  it('rejects malformed and fractional credit input', () => {
    expect(quotePayout('0', policy)).toBeNull();
    expect(quotePayout('10.5', policy)).toBeNull();
    expect(quotePayout('100', { ...policy, fiatMinorPerCredit: '0' })).toBeNull();
  });
});

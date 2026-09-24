import { distributeRevenue } from './revenue-allocation.policy';

describe('revenue distribution', () => {
  it('conserves integer Credits and gives the author the first residual Credit', () => {
    const rows = distributeRevenue(101n, [
      { userId: 'author', type: 'AUTHOR_SHARE', basisPoints: 7000 },
      { userId: 'platform', type: 'PLATFORM_FEE', basisPoints: 2000 },
      { userId: 'contributor', type: 'CONTRIBUTOR', basisPoints: 1000 },
    ]);
    expect(rows.map((row) => row.amount)).toEqual([71n, 20n, 10n]);
    expect(rows.reduce((sum, row) => sum + row.amount, 0n)).toBe(101n);
  });

  it('never gives a residual Credit to a zero-share recipient', () => {
    const rows = distributeRevenue(1n, [
      { userId: 'author', type: 'AUTHOR_SHARE', basisPoints: 0 },
      { userId: 'platform', type: 'PLATFORM_FEE', basisPoints: 3000 },
      { userId: 'contributor', type: 'CONTRIBUTOR', basisPoints: 7000 },
    ]);
    expect(rows.map((row) => row.amount)).toEqual([0n, 0n, 1n]);
  });

  it('rejects incomplete and duplicate recipient shares before allocation', () => {
    expect(() =>
      distributeRevenue(100n, [
        { userId: 'author', type: 'AUTHOR_SHARE', basisPoints: 7000 },
        { userId: 'platform', type: 'PLATFORM_FEE', basisPoints: 2000 },
      ]),
    ).toThrow();
    expect(() =>
      distributeRevenue(100n, [
        { userId: 'same', type: 'AUTHOR_SHARE', basisPoints: 7000 },
        { userId: 'same', type: 'PLATFORM_FEE', basisPoints: 3000 },
      ]),
    ).toThrow();
  });
});

import {
  assertEarlyAccessPricingInput,
  isChapterEffectivelyFree,
  resolveChapterFreeAt,
} from './chapter-pricing-access.policy';

describe('early-access pricing', () => {
  const publishedAt = new Date('2026-09-01T12:00:00.000Z');
  const freeAt = new Date('2026-09-08T12:00:00.000Z');
  const pricing = {
    accessType: 'PAID',
    unlockPolicy: 'EARLY_ACCESS',
    paidWindowDays: 7,
  } as const;

  it('unlocks exactly at the publication-based deadline, without changing pricing', () => {
    const frozen = Object.freeze({ ...pricing });
    expect(
      isChapterEffectivelyFree(
        frozen,
        publishedAt,
        new Date(freeAt.getTime() - 1),
      ),
    ).toBe(false);
    expect(isChapterEffectivelyFree(frozen, publishedAt, freeAt)).toBe(true);
    expect(
      isChapterEffectivelyFree(
        frozen,
        publishedAt,
        new Date(freeAt.getTime() + 1),
      ),
    ).toBe(true);
    expect(frozen).toEqual(pricing);
  });

  it('uses explicit deadline and fails closed for invalid or incomplete schedules', () => {
    expect(resolveChapterFreeAt({ ...pricing, freeAt }, publishedAt)).toEqual(
      freeAt,
    );
    expect(isChapterEffectivelyFree(pricing, null, freeAt)).toBe(false);
    expect(
      isChapterEffectivelyFree(
        { ...pricing, freeAt: new Date('invalid') },
        publishedAt,
        freeAt,
      ),
    ).toBe(false);
    expect(
      isChapterEffectivelyFree(
        { ...pricing, paidWindowDays: -1 },
        publishedAt,
        freeAt,
      ),
    ).toBe(false);
    expect(
      isChapterEffectivelyFree(
        { accessType: 'PAID', unlockPolicy: 'PERMANENT_PAID', freeAt },
        publishedAt,
        freeAt,
      ),
    ).toBe(false);
    expect(isChapterEffectivelyFree(null, null, freeAt)).toBe(true);
  });

  it.each([
    { accessType: 'FREE', unlockPolicy: 'EARLY_ACCESS', freeAt },
    { accessType: 'PAID', unlockPolicy: 'EARLY_ACCESS' },
    { ...pricing, freeAt },
    { ...pricing, paidWindowDays: 0 },
    { ...pricing, paidWindowDays: 1.5 },
    { ...pricing, paidWindowDays: 3651 },
    { accessType: 'PAID', unlockPolicy: 'PERMANENT_PAID', freeAt },
  ] as const)('rejects incoherent configuration %#', (input) => {
    expect(() => assertEarlyAccessPricingInput(input)).toThrow();
  });

  it('allows draft-relative and explicit deadlines, including making a chapter free immediately', () => {
    expect(() => assertEarlyAccessPricingInput(pricing)).not.toThrow();
    expect(() =>
      assertEarlyAccessPricingInput({
        accessType: 'PAID',
        unlockPolicy: 'EARLY_ACCESS',
        freeAt,
      }),
    ).not.toThrow();
  });
});

import {
  assertSetChapterPricingInput,
  assertUnlockChapterInput,
  buildServerControlledPreview,
} from './chapter-monetization.policy';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';
const CHAPTER_ID = '33333333-3333-4333-8333-333333333333';
const PRICE_BAND_ID = '44444444-4444-4444-8444-444444444444';

describe('chapter monetization policy', () => {
  it('generates a bounded server-controlled preview that is shorter than content', () => {
    const content = 'Nội dung chương '.repeat(400);

    const preview = buildServerControlledPreview(content);

    expect(preview.length).toBeLessThan(content.trim().length);
    expect(preview.length).toBeLessThanOrEqual(1_200);
    expect(content.trim().startsWith(preview)).toBe(true);
  });

  it('requires a price band for paid chapters and rejects it for free chapters', () => {
    expect(() =>
      assertSetChapterPricingInput({
        actorId: ACTOR_ID,
        storyId: STORY_ID,
        chapterId: CHAPTER_ID,
        accessType: 'PAID',
      }),
    ).toThrow('price band');

    expect(() =>
      assertSetChapterPricingInput({
        actorId: ACTOR_ID,
        storyId: STORY_ID,
        chapterId: CHAPTER_ID,
        accessType: 'FREE',
        priceBandId: PRICE_BAND_ID,
      }),
    ).toThrow('price band');
  });

  it('requires a bounded idempotency key for an unlock', () => {
    expect(() =>
      assertUnlockChapterInput({
        userId: ACTOR_ID,
        chapterId: CHAPTER_ID,
        idempotencyKey: 'short',
      }),
    ).toThrow('Idempotency key');
  });
});

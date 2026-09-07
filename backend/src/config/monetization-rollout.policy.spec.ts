import type { MonetizationConfig } from './config.types';
import {
  canCreateTopUpOrder,
  isChapterInMonetizationRollout,
  shouldEnforceChapterPaywall,
} from './monetization-rollout.policy';

const internalUserId = '11111111-1111-4111-8111-111111111111';
const rolloutStoryId = '22222222-2222-4222-8222-222222222222';

function config(
  rolloutStage: MonetizationConfig['rolloutStage'],
): MonetizationConfig {
  return {
    enabled: true,
    authorPricingEnabled: true,
    paymentProviderEnabled: true,
    paywallEnforcementEnabled: true,
    rolloutStage,
    internalUserIds: [internalUserId],
    storyAllowlistIds: [rolloutStoryId],
    integrityMetricsIntervalMs: 60_000,
  };
}

describe('monetization rollout policy', () => {
  it.each(['sandbox', 'internal'] as const)(
    '%s chỉ cho internal user vào paywall cohort',
    (stage) => {
      expect(
        isChapterInMonetizationRollout({
          config: config(stage),
          userId: internalUserId,
          storyId: '33333333-3333-4333-8333-333333333333',
        }),
      ).toBe(true);
      expect(
        isChapterInMonetizationRollout({
          config: config(stage),
          userId: undefined,
          storyId: rolloutStoryId,
        }),
      ).toBe(false);
    },
  );

  it('story_allowlist enforce cho story được chọn và vẫn cho internal user', () => {
    expect(
      shouldEnforceChapterPaywall({
        config: config('story_allowlist'),
        userId: undefined,
        storyId: rolloutStoryId,
      }),
    ).toBe(true);
    expect(
      shouldEnforceChapterPaywall({
        config: config('story_allowlist'),
        userId: internalUserId,
        storyId: '33333333-3333-4333-8333-333333333333',
      }),
    ).toBe(true);
  });

  it('general enforce cho mọi reader và cho phép top-up', () => {
    const general = config('general');
    expect(
      isChapterInMonetizationRollout({
        config: general,
        userId: undefined,
        storyId: '33333333-3333-4333-8333-333333333333',
      }),
    ).toBe(true);
    expect(
      canCreateTopUpOrder(general, '33333333-3333-4333-8333-333333333333'),
    ).toBe(true);
  });

  it('không enforce khi paywall kill switch tắt', () => {
    const disabled = { ...config('general'), paywallEnforcementEnabled: false };
    expect(
      shouldEnforceChapterPaywall({
        config: disabled,
        userId: undefined,
        storyId: rolloutStoryId,
      }),
    ).toBe(false);
  });
});

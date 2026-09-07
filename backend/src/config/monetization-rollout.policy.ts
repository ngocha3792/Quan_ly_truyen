import type { MonetizationConfig } from './config.types';

export function isInternalMonetizationUser(
  config: MonetizationConfig,
  userId: string | undefined,
): boolean {
  return Boolean(
    userId && config.internalUserIds.includes(userId.trim().toLowerCase()),
  );
}

export function isChapterInMonetizationRollout(input: {
  readonly config: MonetizationConfig;
  readonly userId: string | undefined;
  readonly storyId: string;
}): boolean {
  if (!input.config.enabled) return false;
  if (isInternalMonetizationUser(input.config, input.userId)) return true;

  if (input.config.rolloutStage === 'general') return true;
  if (input.config.rolloutStage === 'story_allowlist') {
    return input.config.storyAllowlistIds.includes(
      input.storyId.trim().toLowerCase(),
    );
  }
  return false;
}

export function shouldEnforceChapterPaywall(input: {
  readonly config: MonetizationConfig;
  readonly userId: string | undefined;
  readonly storyId: string;
}): boolean {
  return (
    input.config.paywallEnforcementEnabled &&
    isChapterInMonetizationRollout(input)
  );
}

export function canCreateTopUpOrder(
  config: MonetizationConfig,
  userId: string,
): boolean {
  if (!config.enabled || !config.paymentProviderEnabled) return false;
  if (isInternalMonetizationUser(config, userId)) return true;
  return (
    config.rolloutStage === 'story_allowlist' ||
    config.rolloutStage === 'general'
  );
}

import { registerAs } from '@nestjs/config';

import type { MonetizationConfig } from './config.types';

export const MONETIZATION_CONFIG_KEY = 'monetization';

export default registerAs(MONETIZATION_CONFIG_KEY, (): MonetizationConfig => ({
  enabled: process.env.MONETIZATION_ENABLED === 'true',
  authorPricingEnabled: process.env.AUTHOR_PRICING_ENABLED === 'true',
  paymentProviderEnabled: process.env.PAYMENT_PROVIDER_ENABLED === 'true',
  paywallEnforcementEnabled: process.env.PAYWALL_ENFORCEMENT_ENABLED === 'true',
  rolloutStage: readRolloutStage(process.env.MONETIZATION_ROLLOUT_STAGE),
  internalUserIds: readCsv(process.env.MONETIZATION_INTERNAL_USER_IDS),
  storyAllowlistIds: readCsv(process.env.MONETIZATION_STORY_ALLOWLIST_IDS),
  integrityMetricsIntervalMs: readPositiveInteger(
    process.env.MONETIZATION_INTEGRITY_METRICS_INTERVAL_MS,
    60_000,
  ),
}));

function readRolloutStage(
  value: string | undefined,
): MonetizationConfig['rolloutStage'] {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === 'internal' ||
    normalized === 'story_allowlist' ||
    normalized === 'general'
  ) {
    return normalized;
  }
  return 'sandbox';
}

function readCsv(value: string | undefined): readonly string[] {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

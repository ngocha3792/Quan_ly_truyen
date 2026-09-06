import { AiRateLimitTier } from '../../domain/enums';

export interface AiTierLimit {
  readonly windowSeconds: number;
  readonly requests: number;
  readonly tokens: number;
}

export const AI_TIER_LIMITS: Readonly<Record<AiRateLimitTier, AiTierLimit>> = {
  [AiRateLimitTier.FREE]: {
    windowSeconds: 3_600,
    requests: 20,
    tokens: 50_000,
  },
  [AiRateLimitTier.PRO]: {
    windowSeconds: 3_600,
    requests: 200,
    tokens: 1_000_000,
  },
  [AiRateLimitTier.ENTERPRISE]: {
    windowSeconds: 3_600,
    requests: 2_000,
    tokens: 10_000_000,
  },
};

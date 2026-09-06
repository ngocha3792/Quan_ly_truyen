import type { AiPolicyView } from '../../../application';
import type { AiFallbackPolicy, AiRateLimitTier } from '../../../domain/enums';

export interface AiPolicyResponse {
  readonly userId: string;
  readonly rateLimitTier: AiRateLimitTier;
  readonly fallbackPolicy: AiFallbackPolicy;
  readonly limits: {
    readonly windowSeconds: number;
    readonly requests: number;
    readonly tokens: number;
  };
  readonly updatedAt: string | null;
}

export function toAiPolicyResponse(view: AiPolicyView): AiPolicyResponse {
  return {
    userId: view.userId,
    rateLimitTier: view.rateLimitTier,
    fallbackPolicy: view.fallbackPolicy,
    limits: view.limits,
    updatedAt: view.updatedAt?.toISOString() ?? null,
  };
}

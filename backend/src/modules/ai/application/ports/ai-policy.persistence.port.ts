import type { AiFallbackPolicy, AiRateLimitTier } from '../../domain/enums';

export const AI_POLICY_PERSISTENCE_PORT = Symbol.for(
  'modules.ai.policy-persistence',
);

export interface AiUserPolicyRecord {
  readonly userId: string;
  readonly rateLimitTier: AiRateLimitTier;
  readonly fallbackPolicy: AiFallbackPolicy;
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;
}

export interface UpdateAiUserPolicyInput {
  readonly rateLimitTier?: AiRateLimitTier;
  readonly fallbackPolicy?: AiFallbackPolicy;
}

export interface AiPolicyPersistencePort {
  findByUserId(userId: string): Promise<AiUserPolicyRecord | null>;

  userExists(userId: string): Promise<boolean>;

  upsert(
    userId: string,
    input: UpdateAiUserPolicyInput,
  ): Promise<AiUserPolicyRecord>;
}

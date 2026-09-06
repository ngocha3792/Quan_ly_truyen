import { IsEnum, IsOptional } from 'class-validator';

import { AiFallbackPolicy, AiRateLimitTier } from '../../../domain/enums';

export class UpdateOwnAiPolicyRequest {
  @IsEnum(AiFallbackPolicy)
  fallbackPolicy!: AiFallbackPolicy;
}

export class UpdateManagedAiPolicyRequest {
  @IsOptional()
  @IsEnum(AiRateLimitTier)
  rateLimitTier?: AiRateLimitTier;

  @IsOptional()
  @IsEnum(AiFallbackPolicy)
  fallbackPolicy?: AiFallbackPolicy;
}

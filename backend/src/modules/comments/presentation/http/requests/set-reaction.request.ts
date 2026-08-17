import { IsEnum } from 'class-validator';
import { ReactionType } from '@/generated/prisma/client';

export class SetReactionRequest {
  @IsEnum(ReactionType)
  type!: keyof typeof ReactionType;
}

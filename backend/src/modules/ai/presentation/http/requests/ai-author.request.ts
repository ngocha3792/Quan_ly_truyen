import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import {
  AUTHOR_JOB_TYPES,
  type AuthorJobType,
} from '../../../application/author-tools/ai-author.types';

export class CreateAiAuthorJobRequest {
  @IsIn(AUTHOR_JOB_TYPES) jobType!: AuthorJobType;
  @IsUUID('4') connectionId!: string;
  @IsOptional() @IsUUID('4') chapterId?: string;
  @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
}
export class AiAuthorIssuesRequest {
  @IsOptional() @IsUUID('4') chapterId?: string;
}
export class VerifyAiCharacterRequest {
  @IsBoolean() isVerified!: boolean;
}
export class UpdateAiConsistencyRequest {
  @IsOptional() @IsBoolean() isDismissed?: boolean;
  @IsOptional() @IsBoolean() isResolved?: boolean;
}

import { IsString, MaxLength, MinLength } from 'class-validator';
import { ReaderEngagementPolicy } from '../../../domain';

export class CreateStoryCommentRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(ReaderEngagementPolicy.COMMENT_MAX_LENGTH)
  body!: string;
}

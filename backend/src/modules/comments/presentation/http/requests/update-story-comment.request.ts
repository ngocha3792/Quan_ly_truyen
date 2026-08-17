import { IsString, MaxLength, MinLength } from 'class-validator';
import { CommentPolicy } from '../../../domain';

export class UpdateStoryCommentRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(CommentPolicy.MAX_LENGTH)
  body!: string;
}

import { IsString, MaxLength, MinLength } from 'class-validator';
import { CommentPolicy } from '../../../domain';

export class CreateStoryCommentRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(CommentPolicy.MAX_LENGTH)
  body!: string;
}

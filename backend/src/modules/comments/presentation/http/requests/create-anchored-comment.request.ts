import { Type } from 'class-transformer';
import {
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CommentPolicy } from '../../../domain';

class TextRangeAnchorRequest {
  @IsUUID('4') startBlockId!: string;
  @Min(0) @Max(1_000_000) startOffset!: number;
  @IsUUID('4') endBlockId!: string;
  @Min(0) @Max(1_000_000) endOffset!: number;
  @IsString() @MinLength(10) @MaxLength(2000) quoteText!: string;
}

export class CreateAnchoredCommentRequest {
  @IsString() @MinLength(1) @MaxLength(CommentPolicy.MAX_LENGTH) body!: string;
  @ValidateNested()
  @Type(() => TextRangeAnchorRequest)
  anchor!: TextRangeAnchorRequest;
}

import { Type } from 'class-transformer';
import {
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CommentPolicy } from '../../../domain';

class ComicRegionRequest {
  @IsNumber() @Min(0) @Max(1) x!: number;
  @IsNumber() @Min(0) @Max(1) y!: number;
  @IsNumber() @Min(0.000001) @Max(1) width!: number;
  @IsNumber() @Min(0.000001) @Max(1) height!: number;
}

export class CreateComicRegionCommentRequest {
  @IsString() @MinLength(1) @MaxLength(CommentPolicy.MAX_LENGTH) body!: string;
  @ValidateNested() @Type(() => ComicRegionRequest) region!: ComicRegionRequest;
}

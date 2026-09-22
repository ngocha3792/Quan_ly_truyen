import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class AttachChapterMediaPageRequest {
  @IsUUID('4')
  mediaAssetId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  altText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  caption?: string;
}

export class AttachChapterMediaRequest {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AttachChapterMediaPageRequest)
  pages!: AttachChapterMediaPageRequest[];
}

export class ReorderChapterMediaRequest {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  orderedMediaAssetIds!: string[];
}

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { ChapterDraftPolicy, ChapterImportPolicy } from '../../../domain';

export class ImportChapterDraftRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(ChapterDraftPolicy.TITLE_MAX_LENGTH)
  title!: string;

  /**
   * Cho phép rỗng: bản thảo hay có tiêu đề chương mà chưa viết nội dung, và
   * chặn ở đây thì cả lô hỏng vì một chương trống.
   */
  @IsString()
  @MaxLength(ChapterImportPolicy.MAX_CONTENT_LENGTH)
  content!: string;
}

export class ImportAuthorChaptersRequest {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ChapterImportPolicy.MAX_PER_CALL)
  @ValidateNested({ each: true })
  @Type(() => ImportChapterDraftRequest)
  chapters!: ImportChapterDraftRequest[];
}

import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ChapterDraftPolicy } from '../../../domain';

export class CreateAuthorChapterRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(ChapterDraftPolicy.TITLE_MAX_LENGTH)
  title!: string;

  @IsOptional()
  @IsString()
  content?: string | null;

  /**
   * Chèn chương mới ngay sau chương này. Bỏ trống thì thêm vào đuôi truyện như
   * cũ.
   */
  @IsOptional()
  @IsUUID('4')
  afterChapterId?: string;

  /**
   * Chèn chương mới ngay trước chương này. Trỏ vào chương đầu truyện để thêm
   * chương mở đầu.
   */
  @IsOptional()
  @IsUUID('4')
  beforeChapterId?: string;
}

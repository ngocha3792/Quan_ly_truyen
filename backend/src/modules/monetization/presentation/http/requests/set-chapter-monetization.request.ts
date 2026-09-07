import { IsIn, IsOptional, IsUUID } from 'class-validator';

import {
  CHAPTER_ACCESS_TYPES,
  type ChapterAccessTypeName,
} from '../../../domain';

export class SetChapterMonetizationRequest {
  @IsIn(CHAPTER_ACCESS_TYPES)
  accessType!: ChapterAccessTypeName;

  @IsOptional()
  @IsUUID('4')
  priceBandId?: string;
}

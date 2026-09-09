import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

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

  @IsOptional() @IsIn(['PERMANENT_PAID', 'EARLY_ACCESS']) unlockPolicy?:
    'PERMANENT_PAID' | 'EARLY_ACCESS';
  @IsOptional() @IsDateString() freeAt?: string;
  @IsOptional() @IsInt() @Min(1) paidWindowDays?: number;
}

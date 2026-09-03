import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
} from 'class-validator';
import { AuthorLifecycleStatus } from '../../../domain';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '@/common/constants';

export class ListAdminAuthorsRequest {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(160)
  search?: string;
  @IsOptional()
  @IsEnum(AuthorLifecycleStatus)
  status?: AuthorLifecycleStatus;
  @IsOptional()
  @IsDateString()
  createdFrom?: string;
  @IsOptional()
  @IsDateString()
  createdTo?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = DEFAULT_PAGE;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  pageSize = DEFAULT_PAGE_LIMIT;
}

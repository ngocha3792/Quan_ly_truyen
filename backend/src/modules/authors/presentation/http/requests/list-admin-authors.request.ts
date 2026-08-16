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
  page = 1;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

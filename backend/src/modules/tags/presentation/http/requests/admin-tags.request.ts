import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { normalizeTagName } from '../../../domain';

export class ListAdminTagsRequest {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  q?: string;
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
  @IsOptional()
  @IsIn(['name:asc', 'name:desc', 'createdAt:asc', 'createdAt:desc'])
  sort = 'name:asc';
}

export class CreateTagRequest {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeTagName(value) : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

export class UpdateTagRequest extends CreateTagRequest {}

export class MergeTagRequest {
  @IsUUID('4')
  targetTagId!: string;
}

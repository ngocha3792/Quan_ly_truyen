import { Type } from 'class-transformer';

import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { AuthorApplicationStatus } from '../../../domain';

export class ListAuthorApplicationsRequest {
  @IsOptional()
  @IsEnum(AuthorApplicationStatus)
  status?: AuthorApplicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

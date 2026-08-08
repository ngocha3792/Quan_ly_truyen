import { Type } from 'class-transformer';

import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import { AuthorApplicationStatus } from '../../../domain';

export class ListAuthorApplicationsRequest {
  @IsOptional()
  @IsEnum(AuthorApplicationStatus)
  status?: AuthorApplicationStatus;

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

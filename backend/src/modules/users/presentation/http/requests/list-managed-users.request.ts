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

import { RoleCode } from '@/common/enums';

import { ManagedUserStatus } from '../../../domain';

export class ListManagedUsersRequest {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  keyword?: string;

  @IsOptional()
  @IsEnum(ManagedUserStatus)
  status?: ManagedUserStatus;

  @IsOptional()
  @IsEnum(RoleCode)
  role?: RoleCode;

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

import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ManagedUserStatus } from '../../../domain';
export class UpdateManagedUserStatusRequest {
  @IsEnum(ManagedUserStatus) status!: ManagedUserStatus;
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MaxLength(1000) reason?: string;
}

import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListFollowingRequest {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value.flatMap((item) => String(item).split(',')).map((item) => item.trim()).filter(Boolean);
    return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  })
  @IsArray()
  @IsUUID('4', { each: true })
  authorIds?: string[];
}

import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsUUID, Min } from 'class-validator';

export class SaveReadingProgressRequest {
  @IsUUID('4')
  chapterId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position: number = 0;

  @IsOptional()
  @IsObject()
  cursor?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  sync?: Record<string, unknown>;
}

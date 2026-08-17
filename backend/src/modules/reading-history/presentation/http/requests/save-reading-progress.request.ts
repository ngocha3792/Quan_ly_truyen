import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class SaveReadingProgressRequest {
  @IsUUID('4')
  chapterId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position: number = 0;
}

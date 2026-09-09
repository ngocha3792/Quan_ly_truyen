import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class ChapterVersionDiffRequest {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  from!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  to!: number;
}

import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpsertStoryRatingRequest {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;
}

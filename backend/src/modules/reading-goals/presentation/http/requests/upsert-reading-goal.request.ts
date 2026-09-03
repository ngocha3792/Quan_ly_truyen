import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpsertReadingGoalRequest {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  targetChapters!: number;
}

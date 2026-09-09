import { IsInt, Min } from 'class-validator';

export class ChapterExpectedVersionRequest {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

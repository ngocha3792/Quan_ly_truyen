import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
export class RejectStorySubmissionRequest {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(10, 1000)
  reviewerNote!: string;
}

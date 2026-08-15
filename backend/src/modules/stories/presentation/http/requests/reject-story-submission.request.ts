import { IsString, Length } from 'class-validator';

export class RejectStorySubmissionRequest {
  @IsString()
  @Length(10, 2000)
  reviewerNote!: string;
}

import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitAuthorStoryRequest {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  authorNote?: string;
}

import { IsString, Length } from 'class-validator';

export class RejectAuthorApplicationRequest {
  @IsString()
  @Length(10, 1000)
  reason!: string;
}

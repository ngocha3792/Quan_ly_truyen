import { IsUUID } from 'class-validator';

export class SubmitAuthorApplicationRequest {
  @IsUUID('4')
  applicationId!: string;

  @IsUUID('4')
  sampleMediaId!: string;
}

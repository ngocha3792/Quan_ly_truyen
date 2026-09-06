import { IsOptional, IsUUID } from 'class-validator';

export class RequestChapterTranslationRequest {
  @IsOptional()
  @IsUUID('4')
  connectionId?: string;
}

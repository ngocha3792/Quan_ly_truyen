import { IsIn, IsOptional } from 'class-validator';

import { OCR_LANGUAGES, type OcrLanguage } from '../../../domain';

export class RequestChapterOcrRequest {
  @IsOptional()
  @IsIn(OCR_LANGUAGES)
  language?: OcrLanguage;
}

import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { MediaModule } from '@/modules/media';

import { OCR_PERSISTENCE_PORT, OCR_PROVIDER_PORT } from './application';
import {
  OcrProcessor,
  PaddleOcrAdapter,
  PrismaOcrPersistence,
} from './infrastructure';

@Module({
  imports: [PrismaModule, MediaModule],
  providers: [
    PrismaOcrPersistence,
    PaddleOcrAdapter,
    OcrProcessor,
    { provide: OCR_PERSISTENCE_PORT, useExisting: PrismaOcrPersistence },
    { provide: OCR_PROVIDER_PORT, useExisting: PaddleOcrAdapter },
  ],
})
export class OcrWorkerModule {}

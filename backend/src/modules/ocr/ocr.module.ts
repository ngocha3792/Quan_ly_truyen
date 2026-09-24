import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { MediaModule } from '@/modules/media';

import {
  GetChapterOcrQueryHandler,
  OCR_PERSISTENCE_PORT,
  OCR_PROVIDER_PORT,
  OCR_QUEUE_PORT,
  RequestChapterOcrCommandHandler,
} from './application';
import {
  OcrQueueAdapter,
  PaddleOcrAdapter,
  PrismaOcrPersistence,
} from './infrastructure';
import { OcrController, OcrFeatureGuard } from './presentation';

const adapters = [PrismaOcrPersistence, PaddleOcrAdapter, OcrQueueAdapter];
const ports = [
  { provide: OCR_PERSISTENCE_PORT, useExisting: PrismaOcrPersistence },
  { provide: OCR_PROVIDER_PORT, useExisting: PaddleOcrAdapter },
  { provide: OCR_QUEUE_PORT, useExisting: OcrQueueAdapter },
];

@Module({
  imports: [PrismaModule, MediaModule],
  controllers: [OcrController],
  providers: [
    ...adapters,
    ...ports,
    OcrFeatureGuard,
    RequestChapterOcrCommandHandler,
    GetChapterOcrQueryHandler,
  ],
  // Tokens are exported alongside the classes: a consumer that imports this
  // module injects the port, not the concrete adapter.
  exports: [
    ...adapters.map((adapter) => adapter),
    OCR_PERSISTENCE_PORT,
    OCR_PROVIDER_PORT,
    OCR_QUEUE_PORT,
  ],
})
export class OcrModule {}

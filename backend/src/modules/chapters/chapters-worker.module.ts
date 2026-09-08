import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { ObservabilityModule } from '@/infrastructure/observability';
import { MediaModule } from '@/modules/media';

import { CHAPTER_PERSISTENCE_PORT } from './application';
import {
  ChapterSchedulingProcessor,
  ChapterSchedulingScheduler,
  PrismaChapterPersistence,
} from './infrastructure';

@Module({
  imports: [PrismaModule, ObservabilityModule, MediaModule],
  providers: [
    PrismaChapterPersistence,
    ChapterSchedulingProcessor,
    ChapterSchedulingScheduler,
    {
      provide: CHAPTER_PERSISTENCE_PORT,
      useExisting: PrismaChapterPersistence,
    },
  ],
})
export class ChaptersWorkerModule {}

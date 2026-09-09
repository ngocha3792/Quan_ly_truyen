import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { TRANSLATION_REVIEW_PORT } from './application/ports/translation-review.port';
import { ReviewTranslationCommandHandler } from './application/commands/review-translation/review-translation.command-handler';
import { PrismaTranslationReviewPersistence } from './infrastructure/persistence/prisma-translation-review.persistence';
import { TranslationReviewController } from './presentation/http/controllers/translation-review.controller';

@Module({
  imports: [PrismaModule],
  controllers: [TranslationReviewController],
  providers: [
    ReviewTranslationCommandHandler,
    PrismaTranslationReviewPersistence,
    {
      provide: TRANSLATION_REVIEW_PORT,
      useExisting: PrismaTranslationReviewPersistence,
    },
  ],
})
export class TranslationReviewModule {}

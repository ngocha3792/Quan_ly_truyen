import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { RecommendationController } from './presentation/http';
import {
  PrismaRecommendationExperimentPersistence,
  PrismaRecommendationPersistence,
} from './infrastructure';
import {
  RECOMMENDATION_EXPERIMENT_PORT,
  RECOMMENDATION_PORT,
} from './application';

@Module({
  imports: [PrismaModule],
  controllers: [RecommendationController],
  providers: [
    PrismaRecommendationPersistence,
    PrismaRecommendationExperimentPersistence,
    {
      provide: RECOMMENDATION_PORT,
      useExisting: PrismaRecommendationPersistence,
    },
    {
      provide: RECOMMENDATION_EXPERIMENT_PORT,
      useExisting: PrismaRecommendationExperimentPersistence,
    },
  ],
  exports: [
    PrismaRecommendationPersistence,
    PrismaRecommendationExperimentPersistence,
    RECOMMENDATION_PORT,
    RECOMMENDATION_EXPERIMENT_PORT,
  ],
})
export class RecommendationModule {}

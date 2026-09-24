import { Module } from '@nestjs/common';
import { RecommendationModule } from './recommendation.module';
import { RecommendationSimilarityProcessor } from './infrastructure/jobs/recommendation-similarity.processor';

@Module({
  imports: [RecommendationModule],
  providers: [RecommendationSimilarityProcessor],
})
export class RecommendationWorkerModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';
import { CategoriesService, CATEGORY_REPOSITORY } from './application';
import { PrismaCategoryRepository } from './infrastructure';
import { AdminCategoriesController } from './presentation/http/controllers';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [AdminCategoriesController],
  providers: [
    CategoriesService,
    PrismaCategoryRepository,
    { provide: CATEGORY_REPOSITORY, useExisting: PrismaCategoryRepository },
  ],
  exports: [CategoriesService],
})
export class CategoriesModule {}

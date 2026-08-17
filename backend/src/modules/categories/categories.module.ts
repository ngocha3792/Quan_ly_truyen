import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';
import {
  CATEGORY_REPOSITORY,
  CreateCategoryCommandHandler,
  DeleteCategoryCommandHandler,
  ListCategoriesQueryHandler,
  UpdateCategoryCommandHandler,
} from './application';
import { PrismaCategoryRepository } from './infrastructure';
import { AdminCategoriesController } from './presentation/http/controllers';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [AdminCategoriesController],
  providers: [
    ListCategoriesQueryHandler,
    CreateCategoryCommandHandler,
    UpdateCategoryCommandHandler,
    DeleteCategoryCommandHandler,
    PrismaCategoryRepository,
    { provide: CATEGORY_REPOSITORY, useExisting: PrismaCategoryRepository },
  ],
})
export class CategoriesModule {}

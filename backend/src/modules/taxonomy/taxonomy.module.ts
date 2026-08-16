import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';
import { TaxonomyService } from './application';
import { PrismaTaxonomyRepository } from './infrastructure';
import {
  AdminCategoriesController,
  AdminTagsController,
} from './presentation/http/controllers';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [AdminTagsController, AdminCategoriesController],
  providers: [TaxonomyService, PrismaTaxonomyRepository],
})
export class TaxonomyModule {}

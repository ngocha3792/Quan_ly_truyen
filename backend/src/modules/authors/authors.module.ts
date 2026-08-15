import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import { AuthorDashboardController, PublicAuthorsController } from './authors.controller';
import { AuthorsService } from './authors.service';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [PublicAuthorsController, AuthorDashboardController],
  providers: [AuthorsService],
})
export class AuthorsModule {}

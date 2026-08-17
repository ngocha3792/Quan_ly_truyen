import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  LIBRARY_PERSISTENCE_PORT,
  ListLibraryQueryHandler,
  RemoveLibraryEntryCommandHandler,
  UpsertLibraryEntryCommandHandler,
} from './application';
import { PrismaLibraryPersistence } from './infrastructure';
import { LibrariesController } from './presentation';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [LibrariesController],
  providers: [
    ListLibraryQueryHandler,
    UpsertLibraryEntryCommandHandler,
    RemoveLibraryEntryCommandHandler,
    PrismaLibraryPersistence,
    {
      provide: LIBRARY_PERSISTENCE_PORT,
      useExisting: PrismaLibraryPersistence,
    },
  ],
})
export class LibrariesModule {}

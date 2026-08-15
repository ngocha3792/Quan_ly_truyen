import { Inject, Injectable } from '@nestjs/common';
import type { LibraryEntryResultDto } from '../../dto';
import {
  READER_ENGAGEMENT_PERSISTENCE_PORT,
  type ReaderEngagementPersistencePort,
} from '../../ports';
import { requireReaderUserId } from '../../reader-engagement.util';
import { ListLibraryQuery } from './list-library.query';

@Injectable()
export class ListLibraryQueryHandler {
  constructor(
    @Inject(READER_ENGAGEMENT_PERSISTENCE_PORT)
    private readonly persistence: ReaderEngagementPersistencePort,
  ) {}

  execute(query: ListLibraryQuery): Promise<readonly LibraryEntryResultDto[]> {
    return this.persistence.listLibrary(requireReaderUserId(query.userId));
  }
}

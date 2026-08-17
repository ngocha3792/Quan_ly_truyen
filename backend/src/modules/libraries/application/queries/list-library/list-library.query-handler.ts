import { Inject, Injectable } from '@nestjs/common';

import type { LibraryEntryResultDto } from '../../dto';
import { requireLibraryUserId } from '../../../domain/policies/library-auth.policy';
import {
  LIBRARY_PERSISTENCE_PORT,
  type LibraryPersistencePort,
} from '../../ports';
import { ListLibraryQuery } from './list-library.query';

@Injectable()
export class ListLibraryQueryHandler {
  constructor(
    @Inject(LIBRARY_PERSISTENCE_PORT)
    private readonly persistence: LibraryPersistencePort,
  ) {}

  execute(query: ListLibraryQuery): Promise<readonly LibraryEntryResultDto[]> {
    return this.persistence.listMine(requireLibraryUserId(query.userId));
  }
}

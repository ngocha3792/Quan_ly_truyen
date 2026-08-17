import { Inject, Injectable } from '@nestjs/common';

import { requireLibraryUserId } from '../../../domain/policies/library-auth.policy';
import {
  LIBRARY_PERSISTENCE_PORT,
  type LibraryPersistencePort,
} from '../../ports';
import { RemoveLibraryEntryCommand } from './remove-library-entry.command';

@Injectable()
export class RemoveLibraryEntryCommandHandler {
  constructor(
    @Inject(LIBRARY_PERSISTENCE_PORT)
    private readonly persistence: LibraryPersistencePort,
  ) {}

  async execute(command: RemoveLibraryEntryCommand): Promise<void> {
    await this.persistence.removeMine(
      requireLibraryUserId(command.userId),
      command.storyId,
    );
  }
}

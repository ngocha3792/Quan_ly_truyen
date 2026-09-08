import { Inject, Injectable } from '@nestjs/common';

import { requireOfflineUserId } from '../../../domain';
import {
  OFFLINE_READING_PERSISTENCE_PORT,
  type OfflineReadingPersistencePort,
} from '../../ports';
import { DeleteOfflinePackageCommand } from './delete-offline-package.command';

@Injectable()
export class DeleteOfflinePackageCommandHandler {
  constructor(
    @Inject(OFFLINE_READING_PERSISTENCE_PORT)
    private readonly persistence: OfflineReadingPersistencePort,
  ) {}

  execute(command: DeleteOfflinePackageCommand): Promise<void> {
    return this.persistence.deletePackage({
      userId: requireOfflineUserId(command.userId),
      packageId: command.packageId,
      now: new Date(),
    });
  }
}

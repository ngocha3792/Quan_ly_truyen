import { Inject, Injectable } from '@nestjs/common';

import { requireOfflineSessionId, requireOfflineUserId } from '../../../domain';
import type { TouchOfflinePackageResultDto } from '../../dto';
import {
  OFFLINE_READING_PERSISTENCE_PORT,
  type OfflineReadingPersistencePort,
} from '../../ports';
import { TouchOfflinePackageCommand } from './touch-offline-package.command';

@Injectable()
export class TouchOfflinePackageCommandHandler {
  constructor(
    @Inject(OFFLINE_READING_PERSISTENCE_PORT)
    private readonly persistence: OfflineReadingPersistencePort,
  ) {}

  execute(
    command: TouchOfflinePackageCommand,
  ): Promise<TouchOfflinePackageResultDto> {
    return this.persistence.touchPackage({
      userId: requireOfflineUserId(command.userId),
      sessionId: requireOfflineSessionId(command.sessionId),
      packageId: command.packageId,
      now: new Date(),
    });
  }
}

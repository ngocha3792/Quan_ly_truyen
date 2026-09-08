import { Inject, Injectable } from '@nestjs/common';

import {
  OfflinePackagePolicy,
  requireOfflineSessionId,
  requireOfflineUserId,
} from '../../../domain';
import type { OfflinePackageSummaryDto } from '../../dto';
import {
  OFFLINE_READING_PERSISTENCE_PORT,
  type OfflineReadingPersistencePort,
} from '../../ports';
import { CreateOfflinePackageCommand } from './create-offline-package.command';

@Injectable()
export class CreateOfflinePackageCommandHandler {
  constructor(
    @Inject(OFFLINE_READING_PERSISTENCE_PORT)
    private readonly persistence: OfflineReadingPersistencePort,
  ) {}

  execute(
    command: CreateOfflinePackageCommand,
  ): Promise<OfflinePackageSummaryDto> {
    OfflinePackagePolicy.assertChapterSelection(
      command.chapterIds,
      OfflinePackagePolicy.DEFAULT_MAX_CHAPTERS_PER_PACKAGE,
    );

    return this.persistence.createPackage({
      userId: requireOfflineUserId(command.userId),
      sessionId: requireOfflineSessionId(command.sessionId),
      name: OfflinePackagePolicy.normalizeName(command.name),
      description: OfflinePackagePolicy.normalizeDescription(
        command.description,
      ),
      chapterIds: command.chapterIds,
      now: new Date(),
    });
  }
}

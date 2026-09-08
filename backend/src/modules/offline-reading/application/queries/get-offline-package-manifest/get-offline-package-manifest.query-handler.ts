import { Inject, Injectable } from '@nestjs/common';

import { requireOfflineSessionId, requireOfflineUserId } from '../../../domain';
import type { OfflinePackageManifestDto } from '../../dto';
import {
  OFFLINE_READING_PERSISTENCE_PORT,
  type OfflineReadingPersistencePort,
} from '../../ports';
import { GetOfflinePackageManifestQuery } from './get-offline-package-manifest.query';

@Injectable()
export class GetOfflinePackageManifestQueryHandler {
  constructor(
    @Inject(OFFLINE_READING_PERSISTENCE_PORT)
    private readonly persistence: OfflineReadingPersistencePort,
  ) {}

  execute(
    query: GetOfflinePackageManifestQuery,
  ): Promise<OfflinePackageManifestDto> {
    return this.persistence.getManifest({
      userId: requireOfflineUserId(query.userId),
      sessionId: requireOfflineSessionId(query.sessionId),
      packageId: query.packageId,
      now: new Date(),
    });
  }
}

import { Inject, Injectable } from '@nestjs/common';

import { requireOfflineUserId } from '../../../domain';
import type { OfflinePackageSummaryDto } from '../../dto';
import {
  OFFLINE_READING_PERSISTENCE_PORT,
  type OfflineReadingPersistencePort,
} from '../../ports';
import { ListOfflinePackagesQuery } from './list-offline-packages.query';

@Injectable()
export class ListOfflinePackagesQueryHandler {
  constructor(
    @Inject(OFFLINE_READING_PERSISTENCE_PORT)
    private readonly persistence: OfflineReadingPersistencePort,
  ) {}

  execute(
    query: ListOfflinePackagesQuery,
  ): Promise<readonly OfflinePackageSummaryDto[]> {
    return this.persistence.listPackages(
      requireOfflineUserId(query.userId),
      new Date(),
    );
  }
}

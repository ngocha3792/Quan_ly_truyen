import { Inject, Injectable } from '@nestjs/common';

import { requireOfflineUserId } from '../../../domain';
import type { OfflineQuotaDto } from '../../dto';
import {
  OFFLINE_READING_PERSISTENCE_PORT,
  type OfflineReadingPersistencePort,
} from '../../ports';
import { GetOfflineQuotaQuery } from './get-offline-quota.query';

@Injectable()
export class GetOfflineQuotaQueryHandler {
  constructor(
    @Inject(OFFLINE_READING_PERSISTENCE_PORT)
    private readonly persistence: OfflineReadingPersistencePort,
  ) {}

  execute(query: GetOfflineQuotaQuery): Promise<OfflineQuotaDto> {
    return this.persistence.getQuota(
      requireOfflineUserId(query.userId),
      new Date(),
    );
  }
}

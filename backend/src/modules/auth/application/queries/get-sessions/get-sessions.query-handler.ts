import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import type { GetSessionsResultDto } from '../../dto';
import { SessionResultMapper } from '../../mappers';
import {
  SESSION_MANAGEMENT_PERSISTENCE_PORT,
  type ManagedSessionRecord,
  type SessionManagementPersistencePort,
} from '../../ports';

import { GetSessionsQuery } from './get-sessions.query';

@Injectable()
export class GetSessionsQueryHandler {
  constructor(
    @Inject(SESSION_MANAGEMENT_PERSISTENCE_PORT)
    private readonly sessionPersistence: SessionManagementPersistencePort,
  ) {}

  async execute(query: GetSessionsQuery): Promise<GetSessionsResultDto> {
    if (!isUuidV4(query.userId) || !isUuidV4(query.currentSessionId)) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_SESSION_PRINCIPAL_REQUIRED',

        message: 'Không tìm thấy phiên đăng nhập hiện tại',
      });
    }

    const sessions = await this.sessionPersistence.listActiveByUserId(
      query.userId,
      new Date(),
    );

    const sortedSessions = [...sessions].sort((left, right) =>
      this.compareSessions(left, right, query.currentSessionId!),
    );

    return {
      sessions: sortedSessions.map((session) =>
        SessionResultMapper.toDto(session, query.currentSessionId!),
      ),

      total: sortedSessions.length,
    };
  }

  private compareSessions(
    left: ManagedSessionRecord,
    right: ManagedSessionRecord,
    currentSessionId: string,
  ): number {
    if (left.id === currentSessionId) {
      return -1;
    }

    if (right.id === currentSessionId) {
      return 1;
    }

    const leftActivity = left.lastUsedAt ?? left.createdAt;

    const rightActivity = right.lastUsedAt ?? right.createdAt;

    return rightActivity.getTime() - leftActivity.getTime();
  }
}

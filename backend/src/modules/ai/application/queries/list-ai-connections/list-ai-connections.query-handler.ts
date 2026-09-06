import { Inject, Injectable } from '@nestjs/common';

import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AiConnectionPersistencePort,
  AiConnectionRecord,
} from '../../ports/ai-connection.persistence.port';
import { ListAiConnectionsQuery } from './list-ai-connections.query';

@Injectable()
export class ListAiConnectionsQueryHandler {
  constructor(
    @Inject(AI_CONNECTION_PERSISTENCE_PORT)
    private readonly persistence: AiConnectionPersistencePort,
  ) {}

  async execute(
    query: ListAiConnectionsQuery,
  ): Promise<readonly AiConnectionRecord[]> {
    return this.persistence.listByOwner(query.userId);
  }
}

import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '@/common/exceptions';

import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AiConnectionPersistencePort,
} from '../../ports/ai-connection.persistence.port';
import { ListAiConnectionModelsQuery } from './list-ai-connection-models.query';
import { AiResolvedConnectionFactory } from '../../connection-resolution';
import {
  AI_PROTOCOL_REGISTRY_PORT,
  AiProtocolRegistryPort,
} from '../../ports/ai-protocol-registry.port';

@Injectable()
export class ListAiConnectionModelsQueryHandler {
  constructor(
    @Inject(AI_CONNECTION_PERSISTENCE_PORT)
    private readonly persistence: AiConnectionPersistencePort,
    private readonly resolvedConnections: AiResolvedConnectionFactory,
    @Inject(AI_PROTOCOL_REGISTRY_PORT)
    private readonly protocols: AiProtocolRegistryPort,
  ) {}

  async execute(
    query: ListAiConnectionModelsQuery,
  ): Promise<readonly string[]> {
    const connection = await this.persistence.findByOwnerAndId(
      query.userId,
      query.connectionId,
    );

    if (!connection) {
      throw new ResourceNotFoundException({
        resource: 'kết nối AI',
        identifier: query.connectionId,
      });
    }

    const resolved = await this.resolvedConnections.fromRecord(connection);
    return this.protocols.getAdapter(connection.protocol).listModels(resolved);
  }
}

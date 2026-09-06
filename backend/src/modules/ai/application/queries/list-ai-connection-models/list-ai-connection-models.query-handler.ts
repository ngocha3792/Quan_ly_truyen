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
import {
  AiModelInfo,
  AiProtocolRequestError,
} from '../../ports/ai-protocol-adapter.port';
import {
  AI_MODEL_CACHE_PORT,
  AiModelCachePort,
} from '../../ports/ai-model-cache.port';
import { AI_EXTERNAL_OPERATION_REQUEST_COST } from '../../constants/ai-rate-limit.constants';
import { AiRateLimiter } from '../../policy';

const MODEL_CACHE_TTL_SECONDS = 10 * 60;

@Injectable()
export class ListAiConnectionModelsQueryHandler {
  constructor(
    @Inject(AI_CONNECTION_PERSISTENCE_PORT)
    private readonly persistence: AiConnectionPersistencePort,
    private readonly resolvedConnections: AiResolvedConnectionFactory,
    @Inject(AI_PROTOCOL_REGISTRY_PORT)
    private readonly protocols: AiProtocolRegistryPort,
    @Inject(AI_MODEL_CACHE_PORT)
    private readonly cache: AiModelCachePort,
    private readonly rateLimits: AiRateLimiter,
  ) {}

  async execute(
    query: ListAiConnectionModelsQuery,
  ): Promise<readonly AiModelInfo[]> {
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

    if (connection.capabilities?.modelDiscovery === false) return [];

    if (query.refresh) {
      await this.cache.delete(connection.id);
    } else {
      const cached = await this.cache.get(connection.id);
      if (cached) return cached;
    }

    const resolved = await this.resolvedConnections.fromRecord(connection);
    await this.rateLimits.reserveExternalRequests(
      query.actorUserId ?? query.userId,
      AI_EXTERNAL_OPERATION_REQUEST_COST.modelDiscovery,
    );
    let models: readonly AiModelInfo[];
    try {
      models = await this.protocols
        .getAdapter(connection.protocol)
        .listModels(resolved);
    } catch (error) {
      if (
        error instanceof AiProtocolRequestError &&
        [404, 405, 501].includes(error.upstreamStatus ?? 0)
      ) {
        models = [];
      } else {
        throw error;
      }
    }
    await this.cache.set(connection.id, models, MODEL_CACHE_TTL_SECONDS);
    return models;
  }
}

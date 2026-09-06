import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '@/common/exceptions';

import {
  AI_PROVIDER_REGISTRY_PORT,
  AiProviderRegistryPort,
} from '../../ports/ai-provider-registry.port';
import {
  AI_CREDENTIAL_VAULT_PORT,
  AiCredentialVaultPort,
} from '../../ports/ai-credential-vault.port';
import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AiConnectionPersistencePort,
} from '../../ports/ai-connection.persistence.port';
import { ListAiConnectionModelsQuery } from './list-ai-connection-models.query';

@Injectable()
export class ListAiConnectionModelsQueryHandler {
  constructor(
    @Inject(AI_CONNECTION_PERSISTENCE_PORT)
    private readonly persistence: AiConnectionPersistencePort,
    @Inject(AI_CREDENTIAL_VAULT_PORT)
    private readonly vault: AiCredentialVaultPort,
    @Inject(AI_PROVIDER_REGISTRY_PORT)
    private readonly registry: AiProviderRegistryPort,
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

    const apiKey = await this.vault.decrypt(connection.encryptedApiKey);
    const client = this.registry.getClient(connection.provider);

    return client.listModels({
      provider: connection.provider,
      apiKey,
      baseUrl: connection.baseUrl,
      model:
        connection.defaultModel ?? this.registry.getModel(connection.provider),
    });
  }
}

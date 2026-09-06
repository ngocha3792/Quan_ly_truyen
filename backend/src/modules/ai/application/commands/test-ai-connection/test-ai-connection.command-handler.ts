import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '@/common/exceptions';

import { AiProviderRegistry } from '../../../infrastructure/providers/ai-provider.registry';
import {
  AI_CREDENTIAL_VAULT_PORT,
  AiCredentialVaultPort,
} from '../../ports/ai-credential-vault.port';
import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AiConnectionPersistencePort,
} from '../../ports/ai-connection.persistence.port';
import { AiConnectionTestResult } from '../../ports/ai-provider-client.port';
import { TestAiConnectionCommand } from './test-ai-connection.command';

@Injectable()
export class TestAiConnectionCommandHandler {
  constructor(
    @Inject(AI_CONNECTION_PERSISTENCE_PORT)
    private readonly persistence: AiConnectionPersistencePort,
    @Inject(AI_CREDENTIAL_VAULT_PORT)
    private readonly vault: AiCredentialVaultPort,
    private readonly registry: AiProviderRegistry,
  ) {}

  async execute(
    command: TestAiConnectionCommand,
  ): Promise<AiConnectionTestResult> {
    const connection = await this.persistence.findByOwnerAndId(
      command.userId,
      command.connectionId,
    );

    if (!connection) {
      throw new ResourceNotFoundException({
        resource: 'kết nối AI',
        identifier: command.connectionId,
      });
    }

    const apiKey = await this.vault.decrypt(connection.encryptedApiKey);
    const client = this.registry.getClient(connection.provider);

    return client.testConnection({
      provider: connection.provider,
      apiKey,
      baseUrl: connection.baseUrl,
      model:
        connection.defaultModel ?? this.registry.getModel(connection.provider),
    });
  }
}

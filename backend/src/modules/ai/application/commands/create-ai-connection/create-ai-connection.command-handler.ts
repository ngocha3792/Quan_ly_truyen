import { Inject, Injectable } from '@nestjs/common';

import { BusinessRuleViolationException } from '@/common/exceptions';

import { AiProvider } from '../../../domain/enums';
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
  AiConnectionRecord,
} from '../../ports/ai-connection.persistence.port';
import { CreateAiConnectionCommand } from './create-ai-connection.command';

@Injectable()
export class CreateAiConnectionCommandHandler {
  constructor(
    @Inject(AI_CONNECTION_PERSISTENCE_PORT)
    private readonly persistence: AiConnectionPersistencePort,
    @Inject(AI_CREDENTIAL_VAULT_PORT)
    private readonly vault: AiCredentialVaultPort,
    @Inject(AI_PROVIDER_REGISTRY_PORT)
    private readonly registry: AiProviderRegistryPort,
  ) {}

  async execute(
    command: CreateAiConnectionCommand,
  ): Promise<AiConnectionRecord> {
    const { userId, name, provider, apiKey, baseUrl, defaultModel } = command;

    if (
      provider === AiProvider.OPENAI_COMPATIBLE &&
      (!baseUrl || !defaultModel)
    ) {
      throw new BusinessRuleViolationException({
        message:
          'Kết nối OpenAI Compatible cần khai báo Base URL và Model mặc định.',
        rule: 'ai-connection.compatible-requires-base-url-and-model',
      });
    }

    const model = defaultModel ?? this.registry.getModel(provider);
    const client = this.registry.getClient(provider);
    const testResult = await client.testConnection({
      provider,
      apiKey,
      baseUrl,
      model,
    });

    if (!testResult.ok) {
      throw new BusinessRuleViolationException({
        message: testResult.message ?? 'Không thể kết nối bằng API key này.',
        rule: 'ai-connection.test-failed',
      });
    }

    const encryptedApiKey = await this.vault.encrypt(apiKey);

    return this.persistence.create({
      userId,
      name,
      provider,
      encryptedApiKey,
      baseUrl,
      defaultModel,
    });
  }
}

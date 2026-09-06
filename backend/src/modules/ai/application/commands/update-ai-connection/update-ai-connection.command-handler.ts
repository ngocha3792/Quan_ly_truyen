import { Inject, Injectable } from '@nestjs/common';

import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '@/common/exceptions';
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
  UpdateAiConnectionInput,
} from '../../ports/ai-connection.persistence.port';
import { UpdateAiConnectionCommand } from './update-ai-connection.command';

@Injectable()
export class UpdateAiConnectionCommandHandler {
  constructor(
    @Inject(AI_CONNECTION_PERSISTENCE_PORT)
    private readonly persistence: AiConnectionPersistencePort,
    @Inject(AI_CREDENTIAL_VAULT_PORT)
    private readonly vault: AiCredentialVaultPort,
    @Inject(AI_PROVIDER_REGISTRY_PORT)
    private readonly registry: AiProviderRegistryPort,
  ) {}

  async execute(
    command: UpdateAiConnectionCommand,
  ): Promise<AiConnectionRecord> {
    const existing = await this.persistence.findByOwnerAndId(
      command.userId,
      command.connectionId,
    );

    if (!existing) {
      throw new ResourceNotFoundException({
        resource: 'kết nối AI',
        identifier: command.connectionId,
      });
    }

    const { changes } = command;
    const nextBaseUrl =
      changes.baseUrl !== undefined ? changes.baseUrl : existing.baseUrl;
    const nextModel =
      changes.defaultModel !== undefined
        ? changes.defaultModel
        : existing.defaultModel;

    if (
      existing.provider === AiProvider.OPENAI_COMPATIBLE &&
      (!nextBaseUrl || !nextModel)
    ) {
      throw new BusinessRuleViolationException({
        message:
          'Kết nối OpenAI Compatible cần khai báo Base URL và Model mặc định.',
        rule: 'ai-connection.compatible-requires-base-url-and-model',
      });
    }

    let encryptedApiKey: string | undefined;

    if (changes.apiKey !== undefined || changes.baseUrl !== undefined) {
      const apiKeyToTest =
        changes.apiKey ?? (await this.vault.decrypt(existing.encryptedApiKey));
      const client = this.registry.getClient(existing.provider);
      const result = await client.testConnection({
        provider: existing.provider,
        apiKey: apiKeyToTest,
        baseUrl: nextBaseUrl,
        model: nextModel ?? this.registry.getModel(existing.provider),
      });

      if (!result.ok) {
        throw new BusinessRuleViolationException({
          message: result.message ?? 'Không thể kết nối bằng thông tin mới.',
          rule: 'ai-connection.test-failed',
        });
      }

      if (changes.apiKey !== undefined) {
        encryptedApiKey = await this.vault.encrypt(changes.apiKey);
      }
    }

    const update: UpdateAiConnectionInput = {
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(encryptedApiKey !== undefined ? { encryptedApiKey } : {}),
      ...(changes.baseUrl !== undefined ? { baseUrl: changes.baseUrl } : {}),
      ...(changes.defaultModel !== undefined
        ? { defaultModel: changes.defaultModel }
        : {}),
      ...(changes.enabled !== undefined ? { enabled: changes.enabled } : {}),
    };

    return this.persistence.update(command.connectionId, update);
  }
}

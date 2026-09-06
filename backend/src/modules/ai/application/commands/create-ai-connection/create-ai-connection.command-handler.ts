import { Inject, Injectable } from '@nestjs/common';

import { BusinessRuleViolationException } from '@/common/exceptions';

import {
  AI_PROTOCOL_REGISTRY_PORT,
  AiProtocolRegistryPort,
} from '../../ports/ai-protocol-registry.port';
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
    @Inject(AI_PROTOCOL_REGISTRY_PORT)
    private readonly registry: AiProtocolRegistryPort,
  ) {}

  async execute(
    command: CreateAiConnectionCommand,
  ): Promise<AiConnectionRecord> {
    const {
      userId,
      name,
      vendorHint,
      protocol,
      authType,
      authHeaderName,
      credential,
      baseUrl,
      defaultModel,
    } = command;

    const model = defaultModel ?? this.registry.getDefaultModel(protocol);
    const adapter = this.registry.getAdapter(protocol);
    const testResult = await adapter.testConnection({
      protocol,
      vendorHint,
      baseUrl,
      authType,
      authHeaderName,
      credential,
      model,
    });

    if (!testResult.ok) {
      throw new BusinessRuleViolationException({
        message: testResult.message ?? 'Không thể kết nối bằng API key này.',
        rule: 'ai-connection.test-failed',
      });
    }

    const encryptedCredential = await this.vault.encrypt(credential);

    return this.persistence.create({
      userId,
      name,
      vendorHint,
      protocol,
      authType,
      authHeaderName,
      encryptedCredential,
      baseUrl,
      defaultModel,
    });
  }
}

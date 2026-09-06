import { Inject, Injectable } from '@nestjs/common';

import { BusinessRuleViolationException } from '@/common/exceptions';

import {
  AI_PROTOCOL_REGISTRY_PORT,
  AiProtocolRegistryPort,
} from '../../ports/ai-protocol-registry.port';
import type { AiConnectionTestResult } from '../../ports/ai-protocol-adapter.port';
import {
  AI_CREDENTIAL_VAULT_PORT,
  AiCredentialVaultPort,
} from '../../ports/ai-credential-vault.port';
import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AiConnectionPersistencePort,
  AiConnectionRecord,
} from '../../ports/ai-connection.persistence.port';
import {
  AI_SECURITY_AUDIT_PORT,
  AiSecurityAuditPort,
} from '../../ports/ai-security-audit.port';
import { AI_EXTERNAL_OPERATION_REQUEST_COST } from '../../constants/ai-rate-limit.constants';
import { AiRateLimiter } from '../../policy';
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
    private readonly rateLimits: AiRateLimiter,
    @Inject(AI_SECURITY_AUDIT_PORT)
    private readonly audit: AiSecurityAuditPort,
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
    await this.rateLimits.reserveExternalRequests(
      command.actorUserId ?? userId,
      AI_EXTERNAL_OPERATION_REQUEST_COST.connectionValidation,
    );
    const adapter = this.registry.getAdapter(protocol);
    let testResult: AiConnectionTestResult;
    try {
      testResult = await adapter.testConnection({
        protocol,
        vendorHint,
        baseUrl,
        authType,
        authHeaderName,
        credential,
        model,
      });
    } catch (error) {
      await this.audit.record({
        actorUserId: command.actorUserId,
        ownerUserId: userId,
        action: 'ai.connection.created',
        outcome: 'FAILURE',
        metadata: { protocol, authType, vendorHint, model },
      });
      throw error;
    }

    if (!testResult.ok) {
      await this.audit.record({
        actorUserId: command.actorUserId,
        ownerUserId: userId,
        action: 'ai.connection.created',
        outcome: 'FAILURE',
        metadata: { protocol, authType, vendorHint, model },
      });
      throw new BusinessRuleViolationException({
        message: testResult.message ?? 'Không thể kết nối bằng API key này.',
        rule: 'ai-connection.test-failed',
      });
    }

    const encryptedCredential = await this.vault.encrypt(credential);

    const created = await this.persistence.create({
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

    await this.audit.record({
      actorUserId: command.actorUserId,
      ownerUserId: userId,
      action: 'ai.connection.created',
      connectionId: created.id,
      outcome: 'SUCCESS',
      metadata: { protocol, authType, vendorHint, model },
    });
    return created;
  }
}

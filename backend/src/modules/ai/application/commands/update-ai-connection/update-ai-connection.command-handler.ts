import { Inject, Injectable } from '@nestjs/common';

import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '@/common/exceptions';
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
  UpdateAiConnectionInput,
} from '../../ports/ai-connection.persistence.port';
import { UpdateAiConnectionCommand } from './update-ai-connection.command';
import { normalizeAiAuthHeaderName } from '../../../domain/value-objects';
import {
  AI_SECURITY_AUDIT_PORT,
  AiSecurityAuditPort,
} from '../../ports/ai-security-audit.port';
import { AI_EXTERNAL_OPERATION_REQUEST_COST } from '../../constants/ai-rate-limit.constants';
import { AiRateLimiter } from '../../policy';
import type { AiConnectionTestResult } from '../../ports/ai-protocol-adapter.port';

@Injectable()
export class UpdateAiConnectionCommandHandler {
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
    const nextProtocol = changes.protocol ?? existing.protocol;
    const nextBaseUrl = changes.baseUrl || existing.baseUrl;
    const nextModel =
      changes.defaultModel !== undefined
        ? changes.defaultModel
        : existing.defaultModel;
    const nextAuthType = changes.authType ?? existing.authType;
    const nextAuthHeaderName = normalizeAiAuthHeaderName(
      nextAuthType,
      changes.authHeaderName !== undefined
        ? changes.authHeaderName
        : changes.authType !== undefined
          ? null
          : existing.authHeaderName,
    );
    const invalidatesCapabilities =
      changes.apiKey !== undefined ||
      changes.baseUrl !== undefined ||
      changes.defaultModel !== undefined ||
      changes.protocol !== undefined ||
      changes.authType !== undefined ||
      changes.authHeaderName !== undefined;

    let encryptedCredential: string | undefined;

    if (
      changes.apiKey !== undefined ||
      changes.baseUrl !== undefined ||
      changes.protocol !== undefined ||
      changes.authType !== undefined ||
      changes.authHeaderName !== undefined
    ) {
      await this.rateLimits.reserveExternalRequests(
        command.actorUserId ?? command.userId,
        AI_EXTERNAL_OPERATION_REQUEST_COST.connectionValidation,
      );
      const credentialToTest =
        changes.apiKey ??
        (await this.vault.decrypt(existing.encryptedCredential));
      const adapter = this.registry.getAdapter(nextProtocol);
      const model = nextModel ?? this.registry.getDefaultModel(nextProtocol);
      let result: AiConnectionTestResult;
      try {
        result = await adapter.testConnection({
          protocol: nextProtocol,
          vendorHint: existing.vendorHint,
          baseUrl: nextBaseUrl,
          authType: nextAuthType,
          authHeaderName: nextAuthHeaderName,
          credential: credentialToTest,
          model,
        });
      } catch (error) {
        await this.audit.record({
          actorUserId: command.actorUserId,
          ownerUserId: command.userId,
          action: 'ai.connection.updated',
          connectionId: command.connectionId,
          outcome: 'FAILURE',
          metadata: {
            protocol: nextProtocol,
            authType: nextAuthType,
            vendorHint: existing.vendorHint,
            model,
            changedFields: Object.keys(changes),
          },
        });
        throw error;
      }

      if (!result.ok) {
        await this.audit.record({
          actorUserId: command.actorUserId,
          ownerUserId: command.userId,
          action: 'ai.connection.updated',
          connectionId: command.connectionId,
          outcome: 'FAILURE',
          metadata: {
            protocol: nextProtocol,
            authType: nextAuthType,
            vendorHint: existing.vendorHint,
            model,
            changedFields: Object.keys(changes),
          },
        });
        throw new BusinessRuleViolationException({
          message: result.message ?? 'Không thể kết nối bằng thông tin mới.',
          rule: 'ai-connection.test-failed',
        });
      }

      if (changes.apiKey !== undefined) {
        encryptedCredential = await this.vault.encrypt(changes.apiKey);
      }
    }

    const update: UpdateAiConnectionInput = {
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(encryptedCredential !== undefined ? { encryptedCredential } : {}),
      ...(changes.baseUrl !== undefined ? { baseUrl: nextBaseUrl } : {}),
      ...(changes.defaultModel !== undefined
        ? { defaultModel: changes.defaultModel }
        : {}),
      ...(changes.enabled !== undefined ? { enabled: changes.enabled } : {}),
      ...(changes.authType !== undefined ? { authType: nextAuthType } : {}),
      ...(changes.authType !== undefined || changes.authHeaderName !== undefined
        ? { authHeaderName: nextAuthHeaderName }
        : {}),
      ...(changes.protocol !== undefined
        ? { protocol: nextProtocol, vendorHint: existing.vendorHint }
        : {}),
      ...(invalidatesCapabilities
        ? {
            capabilityModel: null,
            capabilities: null,
            capabilitiesProbedAt: null,
          }
        : {}),
    };

    const updated = await this.persistence.update(command.connectionId, update);
    await this.audit.record({
      actorUserId: command.actorUserId,
      ownerUserId: command.userId,
      action: 'ai.connection.updated',
      connectionId: command.connectionId,
      outcome: 'SUCCESS',
      metadata: {
        protocol: updated.protocol,
        authType: updated.authType,
        vendorHint: updated.vendorHint,
        model:
          updated.defaultModel ??
          this.registry.getDefaultModel(updated.protocol),
        changedFields: Object.keys(changes),
      },
    });
    return updated;
  }
}

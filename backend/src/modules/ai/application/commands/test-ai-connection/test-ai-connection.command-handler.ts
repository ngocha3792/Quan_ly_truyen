import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '@/common/exceptions';

import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AiConnectionPersistencePort,
} from '../../ports/ai-connection.persistence.port';
import { AiConnectionTestResult } from '../../ports/ai-protocol-adapter.port';
import { AiResolvedConnectionFactory } from '../../connection-resolution';
import {
  AI_PROTOCOL_REGISTRY_PORT,
  AiProtocolRegistryPort,
} from '../../ports/ai-protocol-registry.port';
import { TestAiConnectionCommand } from './test-ai-connection.command';
import {
  AI_SECURITY_AUDIT_PORT,
  AiSecurityAuditPort,
} from '../../ports/ai-security-audit.port';
import { AI_EXTERNAL_OPERATION_REQUEST_COST } from '../../constants/ai-rate-limit.constants';
import { AiRateLimiter } from '../../policy';

@Injectable()
export class TestAiConnectionCommandHandler {
  constructor(
    @Inject(AI_CONNECTION_PERSISTENCE_PORT)
    private readonly persistence: AiConnectionPersistencePort,
    private readonly resolvedConnections: AiResolvedConnectionFactory,
    @Inject(AI_PROTOCOL_REGISTRY_PORT)
    private readonly protocols: AiProtocolRegistryPort,
    private readonly rateLimits: AiRateLimiter,
    @Inject(AI_SECURITY_AUDIT_PORT)
    private readonly audit: AiSecurityAuditPort,
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

    const resolved = await this.resolvedConnections.fromRecord(connection);
    await this.rateLimits.reserveExternalRequests(
      command.actorUserId ?? command.userId,
      AI_EXTERNAL_OPERATION_REQUEST_COST.connectionTest,
    );
    let result: AiConnectionTestResult;
    try {
      result = await this.protocols
        .getAdapter(connection.protocol)
        .testConnection(resolved);
    } catch (error) {
      await this.audit.record({
        actorUserId: command.actorUserId,
        ownerUserId: command.userId,
        action: 'ai.connection.tested',
        connectionId: command.connectionId,
        outcome: 'FAILURE',
        metadata: {
          protocol: connection.protocol,
          authType: connection.authType,
          vendorHint: connection.vendorHint,
          model: resolved.model,
        },
      });
      throw error;
    }
    await this.audit.record({
      actorUserId: command.actorUserId,
      ownerUserId: command.userId,
      action: 'ai.connection.tested',
      connectionId: command.connectionId,
      outcome: result.ok ? 'SUCCESS' : 'FAILURE',
      metadata: {
        protocol: connection.protocol,
        authType: connection.authType,
        vendorHint: connection.vendorHint,
        model: resolved.model,
      },
    });
    return result;
  }
}

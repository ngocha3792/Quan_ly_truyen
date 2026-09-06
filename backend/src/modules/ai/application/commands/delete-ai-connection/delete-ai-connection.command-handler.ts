import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '@/common/exceptions';

import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AiConnectionPersistencePort,
} from '../../ports/ai-connection.persistence.port';
import {
  AI_SECURITY_AUDIT_PORT,
  AiSecurityAuditPort,
} from '../../ports/ai-security-audit.port';
import { DeleteAiConnectionCommand } from './delete-ai-connection.command';

@Injectable()
export class DeleteAiConnectionCommandHandler {
  constructor(
    @Inject(AI_CONNECTION_PERSISTENCE_PORT)
    private readonly persistence: AiConnectionPersistencePort,
    @Inject(AI_SECURITY_AUDIT_PORT)
    private readonly audit: AiSecurityAuditPort,
  ) {}

  async execute(command: DeleteAiConnectionCommand): Promise<void> {
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

    await this.persistence.delete(command.userId, command.connectionId);
    await this.audit.record({
      actorUserId: command.actorUserId,
      ownerUserId: command.userId,
      action: 'ai.connection.deleted',
      connectionId: command.connectionId,
      outcome: 'SUCCESS',
      metadata: {
        protocol: existing.protocol,
        authType: existing.authType,
        vendorHint: existing.vendorHint,
        model: existing.defaultModel ?? undefined,
      },
    });
  }
}

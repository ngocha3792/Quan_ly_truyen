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

@Injectable()
export class TestAiConnectionCommandHandler {
  constructor(
    @Inject(AI_CONNECTION_PERSISTENCE_PORT)
    private readonly persistence: AiConnectionPersistencePort,
    private readonly resolvedConnections: AiResolvedConnectionFactory,
    @Inject(AI_PROTOCOL_REGISTRY_PORT)
    private readonly protocols: AiProtocolRegistryPort,
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
    return this.protocols
      .getAdapter(connection.protocol)
      .testConnection(resolved);
  }
}

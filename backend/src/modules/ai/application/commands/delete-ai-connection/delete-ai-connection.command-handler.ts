import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '@/common/exceptions';

import {
  AI_CONNECTION_PERSISTENCE_PORT,
  AiConnectionPersistencePort,
} from '../../ports/ai-connection.persistence.port';
import { DeleteAiConnectionCommand } from './delete-ai-connection.command';

@Injectable()
export class DeleteAiConnectionCommandHandler {
  constructor(
    @Inject(AI_CONNECTION_PERSISTENCE_PORT)
    private readonly persistence: AiConnectionPersistencePort,
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
  }
}

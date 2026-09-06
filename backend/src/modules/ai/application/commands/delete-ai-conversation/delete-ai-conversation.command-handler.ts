import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '@/common/exceptions';

import {
  AI_CONVERSATION_PERSISTENCE_PORT,
  AiConversationPersistencePort,
} from '../../ports/ai-conversation.persistence.port';
import { DeleteAiConversationCommand } from './delete-ai-conversation.command';

@Injectable()
export class DeleteAiConversationCommandHandler {
  constructor(
    @Inject(AI_CONVERSATION_PERSISTENCE_PORT)
    private readonly persistence: AiConversationPersistencePort,
  ) {}

  async execute(command: DeleteAiConversationCommand): Promise<void> {
    const conversation = await this.persistence.findById(
      command.conversationId,
      command.userId,
    );

    if (!conversation) {
      throw new ResourceNotFoundException({
        resource: 'cuộc trò chuyện',
        identifier: command.conversationId,
      });
    }

    await this.persistence.delete(command.conversationId, command.userId);
  }
}

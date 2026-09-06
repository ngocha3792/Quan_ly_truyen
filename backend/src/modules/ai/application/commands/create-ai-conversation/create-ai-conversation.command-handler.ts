import { Inject, Injectable } from '@nestjs/common';

import {
  AI_CONVERSATION_PERSISTENCE_PORT,
  AiConversationPersistencePort,
  AiConversationRecord,
} from '../../ports/ai-conversation.persistence.port';
import { CreateAiConversationCommand } from './create-ai-conversation.command';

@Injectable()
export class CreateAiConversationCommandHandler {
  constructor(
    @Inject(AI_CONVERSATION_PERSISTENCE_PORT)
    private readonly persistence: AiConversationPersistencePort,
  ) {}

  async execute(
    command: CreateAiConversationCommand,
  ): Promise<AiConversationRecord> {
    return this.persistence.create(
      command.userId,
      command.provider,
      command.title,
    );
  }
}

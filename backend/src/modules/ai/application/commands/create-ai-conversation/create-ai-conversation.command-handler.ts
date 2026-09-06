import { Inject, Injectable } from '@nestjs/common';

import { BusinessRuleViolationException } from '@/common/exceptions';

import { AiConnectionResolver } from '../../connection-resolution/ai-connection-resolver';
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
    private readonly resolver: AiConnectionResolver,
  ) {}

  async execute(
    command: CreateAiConversationCommand,
  ): Promise<AiConversationRecord> {
    const connection = await this.resolver.resolve({
      userId: command.userId,
      connectionId: command.connectionId,
    });

    if (!connection) {
      throw new BusinessRuleViolationException({
        message: 'Không tìm thấy kết nối AI này hoặc kết nối đã bị tắt.',
        rule: 'ai-connection.not-found',
      });
    }

    return this.persistence.create(
      command.userId,
      connection.id,
      connection.provider,
      command.title,
    );
  }
}

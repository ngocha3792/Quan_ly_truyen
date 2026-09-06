import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '@/common/exceptions';

import {
  AI_CONVERSATION_PERSISTENCE_PORT,
  AiConversationPersistencePort,
} from '../../ports/ai-conversation.persistence.port';
import { GetAiConversationQuery } from './get-ai-conversation.query';
import { AiConversationDetailView } from './get-ai-conversation.view';

@Injectable()
export class GetAiConversationQueryHandler {
  constructor(
    @Inject(AI_CONVERSATION_PERSISTENCE_PORT)
    private readonly persistence: AiConversationPersistencePort,
  ) {}

  async execute(
    query: GetAiConversationQuery,
  ): Promise<AiConversationDetailView> {
    const conversation = await this.persistence.findById(
      query.conversationId,
      query.userId,
    );

    if (!conversation) {
      throw new ResourceNotFoundException({
        resource: 'cuộc trò chuyện',
        identifier: query.conversationId,
      });
    }

    const messages = await this.persistence.findMessages(query.conversationId);

    return { conversation, messages };
  }
}

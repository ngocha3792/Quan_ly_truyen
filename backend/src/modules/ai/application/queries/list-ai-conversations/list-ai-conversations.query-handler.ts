import { Inject, Injectable } from '@nestjs/common';

import {
  AI_CONVERSATION_PERSISTENCE_PORT,
  AiConversationPersistencePort,
  AiConversationRecord,
} from '../../ports/ai-conversation.persistence.port';
import { ListAiConversationsQuery } from './list-ai-conversations.query';

@Injectable()
export class ListAiConversationsQueryHandler {
  constructor(
    @Inject(AI_CONVERSATION_PERSISTENCE_PORT)
    private readonly persistence: AiConversationPersistencePort,
  ) {}

  async execute(
    query: ListAiConversationsQuery,
  ): Promise<readonly AiConversationRecord[]> {
    return this.persistence.listByUser(query.userId);
  }
}

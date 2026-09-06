import { Inject, Injectable } from '@nestjs/common';

import { AiMessageRole } from '../../../domain/enums';
import { AiGatewayPort, AI_GATEWAY_PORT } from '../../ports/ai-gateway.port';
import {
  AI_CONVERSATION_PERSISTENCE_PORT,
  AiConversationPersistencePort,
} from '../../ports/ai-conversation.persistence.port';
import { AiChatContextBuilder } from '../../chat-context/ai-chat-context-builder';
import { SendAiMessageCommand } from './send-ai-message.command';
import { SendAiMessageResultView } from './send-ai-message.view';

@Injectable()
export class SendAiMessageCommandHandler {
  constructor(
    private readonly contextBuilder: AiChatContextBuilder,
    @Inject(AI_CONVERSATION_PERSISTENCE_PORT)
    private readonly conversations: AiConversationPersistencePort,
    @Inject(AI_GATEWAY_PORT)
    private readonly gateway: AiGatewayPort,
  ) {}

  async execute(
    command: SendAiMessageCommand,
  ): Promise<SendAiMessageResultView> {
    const context = await this.contextBuilder.build(
      command.userId,
      command.conversationId,
      command.content,
    );

    const userMessage = await this.conversations.appendMessage(
      command.conversationId,
      AiMessageRole.USER,
      command.content,
    );

    const generateResult = await this.gateway.generate(
      context.resolvedConnection,
      {
        systemPrompt: context.systemPrompt,
        messages: context.protocolMessages,
      },
      { userId: command.userId, connectionId: context.connection.id },
      'CHAT',
      context.systemFallback
        ? {
            connection: context.systemFallback.resolvedConnection,
            connectionId: context.systemFallback.connection.id,
          }
        : null,
    );

    const assistantMessage = await this.conversations.appendMessage(
      command.conversationId,
      AiMessageRole.ASSISTANT,
      generateResult.content,
    );

    await this.conversations.touch(
      command.conversationId,
      context.connection.id !== context.conversation.connectionId
        ? context.connection.id
        : undefined,
    );

    return { userMessage, assistantMessage };
  }
}

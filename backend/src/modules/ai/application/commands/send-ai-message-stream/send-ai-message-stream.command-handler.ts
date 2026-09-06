import { Inject, Injectable } from '@nestjs/common';

import { AiMessageRole } from '../../../domain/enums';
import { AiGatewayPort, AI_GATEWAY_PORT } from '../../ports/ai-gateway.port';
import {
  AI_CONVERSATION_PERSISTENCE_PORT,
  AiConversationPersistencePort,
} from '../../ports/ai-conversation.persistence.port';
import { AiChatContextBuilder } from '../../chat-context/ai-chat-context-builder';
import { SendAiMessageStreamCommand } from './send-ai-message-stream.command';
import { SendAiMessageStreamEvent } from './send-ai-message-stream.view';

@Injectable()
export class SendAiMessageStreamCommandHandler {
  constructor(
    private readonly contextBuilder: AiChatContextBuilder,
    @Inject(AI_CONVERSATION_PERSISTENCE_PORT)
    private readonly conversations: AiConversationPersistencePort,
    @Inject(AI_GATEWAY_PORT)
    private readonly gateway: AiGatewayPort,
  ) {}

  async *execute(
    command: SendAiMessageStreamCommand,
  ): AsyncGenerator<SendAiMessageStreamEvent> {
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

    let fullText = '';

    for await (const delta of this.gateway.generateStream(
      context.providerConfig,
      {
        systemPrompt: context.systemPrompt,
        messages: context.providerMessages,
      },
      { userId: command.userId, connectionId: context.connection.id },
      'CHAT',
      context.systemFallback
        ? {
            config: context.systemFallback.providerConfig,
            connectionId: context.systemFallback.connection.id,
          }
        : null,
    )) {
      if ('text' in delta) {
        fullText += delta.text;
        yield { type: 'delta', text: delta.text };
      }
    }

    const assistantMessage = await this.conversations.appendMessage(
      command.conversationId,
      AiMessageRole.ASSISTANT,
      fullText,
    );

    await this.conversations.touch(
      command.conversationId,
      context.connection.id !== context.conversation.connectionId
        ? context.connection.id
        : undefined,
    );

    yield { type: 'done', userMessage, assistantMessage };
  }
}

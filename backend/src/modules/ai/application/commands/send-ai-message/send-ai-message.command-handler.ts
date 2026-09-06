import { Inject, Injectable } from '@nestjs/common';

import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import { AiMessageRole } from '@/generated/prisma/client';

import { AiProviderRegistry } from '../../../infrastructure/providers/ai-provider.registry';
import { AiGatewayPort, AI_GATEWAY_PORT } from '../../ports/ai-gateway.port';
import {
  AI_CREDENTIAL_VAULT_PORT,
  AiCredentialVaultPort,
} from '../../ports/ai-credential-vault.port';
import {
  AI_CONVERSATION_PERSISTENCE_PORT,
  AiConversationPersistencePort,
} from '../../ports/ai-conversation.persistence.port';
import { AiConnectionResolverService } from '../../services/ai-connection-resolver.service';
import { SendAiMessageCommand } from './send-ai-message.command';
import { SendAiMessageResultView } from './send-ai-message.view';

const PROVIDER_LABEL_FALLBACK = 'nhà cung cấp AI';

@Injectable()
export class SendAiMessageCommandHandler {
  constructor(
    @Inject(AI_CONVERSATION_PERSISTENCE_PORT)
    private readonly conversations: AiConversationPersistencePort,
    @Inject(AI_GATEWAY_PORT)
    private readonly gateway: AiGatewayPort,
    @Inject(AI_CREDENTIAL_VAULT_PORT)
    private readonly vault: AiCredentialVaultPort,
    private readonly resolver: AiConnectionResolverService,
    private readonly registry: AiProviderRegistry,
  ) {}

  async execute(
    command: SendAiMessageCommand,
  ): Promise<SendAiMessageResultView> {
    const conversation = await this.conversations.findById(
      command.conversationId,
      command.userId,
    );

    if (!conversation) {
      throw new ResourceNotFoundException({
        resource: 'cuộc trò chuyện',
        identifier: command.conversationId,
      });
    }

    const connection = await this.resolver.resolve({
      userId: command.userId,
      connectionId: conversation.connectionId,
      provider: conversation.provider,
    });

    if (!connection) {
      throw new BusinessRuleViolationException({
        message: `Chưa cấu hình kết nối cho ${PROVIDER_LABEL_FALLBACK} này. Vui lòng thêm kết nối cá nhân trong phần cài đặt hoặc liên hệ quản trị viên.`,
        rule: 'ai-connection.required',
      });
    }

    const history = await this.conversations.findMessages(
      command.conversationId,
    );

    const userMessage = await this.conversations.appendMessage(
      command.conversationId,
      AiMessageRole.USER,
      command.content,
    );

    const generateResult = await this.gateway.generate(
      {
        provider: connection.provider,
        apiKey: await this.vault.decrypt(connection.encryptedApiKey),
        baseUrl: connection.baseUrl,
        model:
          connection.defaultModel ??
          this.registry.getModel(connection.provider),
      },
      {
        messages: [
          ...history.map((message) => ({
            role:
              message.role === AiMessageRole.ASSISTANT
                ? ('assistant' as const)
                : ('user' as const),
            content: message.content,
          })),
          { role: 'user' as const, content: command.content },
        ],
      },
    );

    const assistantMessage = await this.conversations.appendMessage(
      command.conversationId,
      AiMessageRole.ASSISTANT,
      generateResult.content,
    );

    await this.conversations.touch(
      command.conversationId,
      connection.id !== conversation.connectionId ? connection.id : undefined,
    );

    return { userMessage, assistantMessage };
  }
}

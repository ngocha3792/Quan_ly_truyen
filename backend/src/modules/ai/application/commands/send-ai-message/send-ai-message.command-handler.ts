import { Inject, Injectable } from '@nestjs/common';

import {
  BusinessRuleViolationException,
  ExternalServiceException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import { AiMessageRole, AiProvider } from '@/generated/prisma/client';

import { AiApiKeyCipherAdapter } from '../../../infrastructure/security/ai-api-key-cipher.adapter';
import { AiProviderRegistry } from '../../../infrastructure/providers/ai-provider.registry';
import {
  AI_CONVERSATION_PERSISTENCE_PORT,
  AiConversationPersistencePort,
} from '../../ports/ai-conversation.persistence.port';
import {
  AI_KEY_PERSISTENCE_PORT,
  AiKeyPersistencePort,
} from '../../ports/ai-key.persistence.port';
import { AiProviderRequestError } from '../../ports/ai-provider-client.port';
import { SendAiMessageCommand } from './send-ai-message.command';
import { SendAiMessageResultView } from './send-ai-message.view';

const PROVIDER_LABELS: Record<AiProvider, string> = {
  [AiProvider.GEMINI]: 'Gemini',
  [AiProvider.OPENAI]: 'ChatGPT',
  [AiProvider.ANTHROPIC]: 'Claude',
};

@Injectable()
export class SendAiMessageCommandHandler {
  constructor(
    @Inject(AI_CONVERSATION_PERSISTENCE_PORT)
    private readonly conversations: AiConversationPersistencePort,
    @Inject(AI_KEY_PERSISTENCE_PORT)
    private readonly keys: AiKeyPersistencePort,
    private readonly cipher: AiApiKeyCipherAdapter,
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

    const history = await this.conversations.findMessages(
      command.conversationId,
    );

    const apiKey = await this.resolveEffectiveKey(
      command.userId,
      conversation.provider,
    );

    if (!apiKey) {
      throw new BusinessRuleViolationException({
        message: `Chưa cấu hình API key cho ${PROVIDER_LABELS[conversation.provider]}. Vui lòng thêm API key cá nhân trong phần cài đặt hoặc liên hệ quản trị viên.`,
        rule: 'ai-key.required',
      });
    }

    const userMessage = await this.conversations.appendMessage(
      command.conversationId,
      AiMessageRole.USER,
      command.content,
    );

    const providerMessages = [
      ...history.map((message) => ({
        role:
          message.role === AiMessageRole.ASSISTANT
            ? ('assistant' as const)
            : ('user' as const),
        content: message.content,
      })),
      { role: 'user' as const, content: command.content },
    ];

    let replyText: string;

    try {
      const client = this.registry.getClient(conversation.provider);
      const model = this.registry.getModel(conversation.provider);
      replyText = await client.sendMessage(apiKey, model, providerMessages);
    } catch (error) {
      throw this.toDomainException(error, conversation.provider);
    }

    const assistantMessage = await this.conversations.appendMessage(
      command.conversationId,
      AiMessageRole.ASSISTANT,
      replyText,
    );

    await this.conversations.touch(command.conversationId);

    return { userMessage, assistantMessage };
  }

  private async resolveEffectiveKey(
    userId: string,
    provider: AiProvider,
  ): Promise<string | null> {
    const personal = await this.keys.findByUserAndProvider(userId, provider);
    if (personal) {
      return this.cipher.decrypt(personal.encryptedKey);
    }

    const system = await this.keys.findByUserAndProvider(null, provider);
    if (system) {
      return this.cipher.decrypt(system.encryptedKey);
    }

    return null;
  }

  private toDomainException(
    error: unknown,
    provider: AiProvider,
  ): BusinessRuleViolationException | ExternalServiceException {
    const label = PROVIDER_LABELS[provider];

    if (error instanceof AiProviderRequestError) {
      if (error.upstreamStatus === 401 || error.upstreamStatus === 403) {
        return new BusinessRuleViolationException({
          message: `API key ${label} không hợp lệ hoặc đã bị từ chối. Vui lòng kiểm tra lại API key.`,
          rule: 'ai-key.rejected',
        });
      }

      return new ExternalServiceException({
        service: label,
        message: error.message,
        upstreamStatus: error.upstreamStatus ?? undefined,
        cause: error,
      });
    }

    return new ExternalServiceException({
      service: label,
      cause: error,
    });
  }
}

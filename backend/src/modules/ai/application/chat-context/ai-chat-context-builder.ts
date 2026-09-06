import { Inject, Injectable } from '@nestjs/common';

import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '@/common/exceptions';

import { AiMessageRole } from '../../domain/enums';
import {
  DEFAULT_CHAT_SYSTEM_PROMPT,
  MAX_RECENT_MESSAGES,
} from '../constants/ai-chat.constants';
import {
  AI_PROVIDER_REGISTRY_PORT,
  AiProviderRegistryPort,
} from '../ports/ai-provider-registry.port';
import {
  AI_CREDENTIAL_VAULT_PORT,
  AiCredentialVaultPort,
} from '../ports/ai-credential-vault.port';
import {
  AI_CONVERSATION_PERSISTENCE_PORT,
  AiConversationPersistencePort,
  AiConversationRecord,
} from '../ports/ai-conversation.persistence.port';
import { AiConnectionRecord } from '../ports/ai-connection.persistence.port';
import {
  AiConnectionConfig,
  AiMessage,
} from '../ports/ai-provider-client.port';
import { AiConnectionResolver } from '../connection-resolution/ai-connection-resolver';
import { AiProfileManager } from '../profile';

const PROVIDER_LABEL_FALLBACK = 'nhà cung cấp AI';

export interface AiChatContext {
  readonly conversation: AiConversationRecord;
  readonly connection: AiConnectionRecord;
  readonly providerConfig: AiConnectionConfig;
  readonly systemFallback: {
    readonly connection: AiConnectionRecord;
    readonly providerConfig: AiConnectionConfig;
  } | null;
  readonly systemPrompt: string;
  readonly providerMessages: readonly AiMessage[];
}

/**
 * Shared by the regular and streaming send-message handlers: loads the
 * conversation, resolves which connection to use (falling back if the
 * conversation's original connection was deleted), and builds the
 * provider-ready message list (existing history + the new user turn).
 */
@Injectable()
export class AiChatContextBuilder {
  constructor(
    @Inject(AI_CONVERSATION_PERSISTENCE_PORT)
    private readonly conversations: AiConversationPersistencePort,
    @Inject(AI_CREDENTIAL_VAULT_PORT)
    private readonly vault: AiCredentialVaultPort,
    private readonly resolver: AiConnectionResolver,
    private readonly profiles: AiProfileManager,
    @Inject(AI_PROVIDER_REGISTRY_PORT)
    private readonly registry: AiProviderRegistryPort,
  ) {}

  async build(
    userId: string,
    conversationId: string,
    newUserContent: string,
  ): Promise<AiChatContext> {
    const conversation = await this.conversations.findById(
      conversationId,
      userId,
    );

    if (!conversation) {
      throw new ResourceNotFoundException({
        resource: 'cuộc trò chuyện',
        identifier: conversationId,
      });
    }

    const plan = await this.resolver.resolvePlan({
      userId,
      connectionId: conversation.connectionId,
      provider: conversation.provider,
    });
    const profile = await this.profiles.resolve(userId);

    if (!plan) {
      throw new BusinessRuleViolationException({
        message: `Chưa cấu hình kết nối cho ${PROVIDER_LABEL_FALLBACK} này. Vui lòng thêm kết nối cá nhân trong phần cài đặt hoặc liên hệ quản trị viên.`,
        rule: 'ai-connection.required',
      });
    }

    const history = await this.conversations.findMessages(conversationId);
    const recentHistory = history.slice(-MAX_RECENT_MESSAGES);

    const providerMessages: AiMessage[] = [
      ...recentHistory.map((message) => ({
        role:
          message.role === AiMessageRole.ASSISTANT
            ? ('assistant' as const)
            : ('user' as const),
        content: message.content,
      })),
      { role: 'user' as const, content: newUserContent },
    ];

    const providerConfig = await this.toProviderConfig(
      plan.primary,
      profile.model,
    );
    const systemFallback = plan.systemFallback
      ? {
          connection: plan.systemFallback,
          providerConfig: await this.toProviderConfig(
            plan.systemFallback,
            profile.model,
          ),
        }
      : null;

    return {
      conversation,
      connection: plan.primary,
      providerConfig,
      systemFallback,
      systemPrompt: profile.systemPrompt ?? DEFAULT_CHAT_SYSTEM_PROMPT,
      providerMessages,
    };
  }

  private async toProviderConfig(
    connection: AiConnectionRecord,
    profileModel: string | null,
  ): Promise<AiConnectionConfig> {
    return {
      provider: connection.provider,
      apiKey: await this.vault.decrypt(connection.encryptedApiKey),
      baseUrl: connection.baseUrl,
      model:
        profileModel ??
        connection.defaultModel ??
        this.registry.getModel(connection.provider),
    };
  }
}

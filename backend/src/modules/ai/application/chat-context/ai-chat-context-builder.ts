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
  AI_CONVERSATION_PERSISTENCE_PORT,
  AiConversationPersistencePort,
  AiConversationRecord,
} from '../ports/ai-conversation.persistence.port';
import { AiConnectionRecord } from '../ports/ai-connection.persistence.port';
import {
  AiMessage,
  ResolvedAiConnection,
} from '../ports/ai-protocol-adapter.port';
import {
  AiConnectionResolver,
  AiResolvedConnectionFactory,
} from '../connection-resolution';
import { AiProfileManager } from '../profile';

const CONNECTION_LABEL_FALLBACK = 'kết nối AI';

export interface AiChatContext {
  readonly conversation: AiConversationRecord;
  readonly connection: AiConnectionRecord;
  readonly resolvedConnection: ResolvedAiConnection;
  readonly systemFallback: {
    readonly connection: AiConnectionRecord;
    readonly resolvedConnection: ResolvedAiConnection;
  } | null;
  readonly systemPrompt: string;
  readonly protocolMessages: readonly AiMessage[];
}

/**
 * Shared by the regular and streaming send-message handlers: loads the
 * conversation, resolves which connection to use (falling back if the
 * conversation's original connection was deleted), and builds the
 * protocol-ready message list (existing history + the new user turn).
 */
@Injectable()
export class AiChatContextBuilder {
  constructor(
    @Inject(AI_CONVERSATION_PERSISTENCE_PORT)
    private readonly conversations: AiConversationPersistencePort,
    private readonly resolver: AiConnectionResolver,
    private readonly profiles: AiProfileManager,
    private readonly resolvedConnections: AiResolvedConnectionFactory,
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
      protocol: conversation.protocol,
    });
    const profile = await this.profiles.resolve(userId);

    if (!plan) {
      throw new BusinessRuleViolationException({
        message: `Chưa cấu hình ${CONNECTION_LABEL_FALLBACK} này. Vui lòng thêm kết nối cá nhân trong phần cài đặt hoặc liên hệ quản trị viên.`,
        rule: 'ai-connection.required',
      });
    }

    const history = await this.conversations.findMessages(conversationId);
    const recentHistory = history.slice(-MAX_RECENT_MESSAGES);

    const protocolMessages: AiMessage[] = [
      ...recentHistory.map((message) => ({
        role:
          message.role === AiMessageRole.ASSISTANT
            ? ('assistant' as const)
            : ('user' as const),
        content: message.content,
      })),
      { role: 'user' as const, content: newUserContent },
    ];

    const resolvedConnection = await this.resolvedConnections.fromRecord(
      plan.primary,
      conversation.modelId ?? profile.model,
    );
    const systemFallback = plan.systemFallback
      ? {
          connection: plan.systemFallback,
          resolvedConnection: await this.resolvedConnections.fromRecord(
            plan.systemFallback,
            conversation.modelId ?? profile.model,
          ),
        }
      : null;

    return {
      conversation,
      connection: plan.primary,
      resolvedConnection,
      systemFallback,
      systemPrompt: profile.systemPrompt ?? DEFAULT_CHAT_SYSTEM_PROMPT,
      protocolMessages,
    };
  }
}

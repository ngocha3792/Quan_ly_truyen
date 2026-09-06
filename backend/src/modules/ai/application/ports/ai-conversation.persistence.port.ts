import type { AiMessageRole, AiProtocol } from '../../domain/enums';

export const AI_CONVERSATION_PERSISTENCE_PORT = Symbol.for(
  'modules.ai.conversation-persistence',
);

export interface AiConversationRecord {
  readonly id: string;
  readonly userId: string;
  readonly connectionId: string | null;
  readonly vendorHint: string | null;
  readonly protocol: AiProtocol;
  readonly title: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AiMessageRecord {
  readonly id: string;
  readonly conversationId: string;
  readonly role: AiMessageRole;
  readonly content: string;
  readonly createdAt: Date;
}

export interface AiConversationPersistencePort {
  listByUser(userId: string): Promise<readonly AiConversationRecord[]>;

  findById(
    conversationId: string,
    userId: string,
  ): Promise<AiConversationRecord | null>;

  findMessages(conversationId: string): Promise<readonly AiMessageRecord[]>;

  create(
    userId: string,
    connectionId: string | null,
    vendorHint: string | null,
    protocol: AiProtocol,
    title: string,
  ): Promise<AiConversationRecord>;

  delete(conversationId: string, userId: string): Promise<void>;

  appendMessage(
    conversationId: string,
    role: AiMessageRole,
    content: string,
  ): Promise<AiMessageRecord>;

  touch(conversationId: string, connectionId?: string | null): Promise<void>;
}

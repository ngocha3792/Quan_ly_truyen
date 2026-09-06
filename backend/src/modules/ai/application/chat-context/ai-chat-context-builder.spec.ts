import { AiAuthType, AiProtocol } from '../../domain/enums';
import type { AiConnectionRecord, AiConversationRecord } from '../ports';
import { AiChatContextBuilder } from './ai-chat-context-builder';

const CONNECTION: AiConnectionRecord = {
  id: 'connection-1',
  userId: 'user-1',
  name: 'Personal connection',
  vendorHint: 'OPENAI_COMPATIBLE',
  protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
  authType: AiAuthType.BEARER,
  authHeaderName: null,
  encryptedCredential: 'encrypted',
  baseUrl: 'https://gateway.example.com/v1',
  defaultModel: 'connection-model',
  enabled: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const CONVERSATION: AiConversationRecord = {
  id: 'conversation-1',
  userId: 'user-1',
  connectionId: CONNECTION.id,
  modelId: 'conversation-model',
  vendorHint: CONNECTION.vendorHint,
  protocol: CONNECTION.protocol,
  title: 'Model test',
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe('AiChatContextBuilder model resolution', () => {
  const conversations = {
    findById: jest.fn(),
    findMessages: jest.fn(),
  };
  const resolver = { resolvePlan: jest.fn() };
  const profiles = { resolve: jest.fn() };
  const resolvedConnections = { fromRecord: jest.fn() };
  const builder = new AiChatContextBuilder(
    conversations as never,
    resolver as never,
    profiles as never,
    resolvedConnections as never,
  );

  beforeEach(() => {
    conversations.findById.mockResolvedValue(CONVERSATION);
    conversations.findMessages.mockResolvedValue([]);
    resolver.resolvePlan.mockResolvedValue({
      primary: CONNECTION,
      systemFallback: null,
    });
    profiles.resolve.mockResolvedValue({
      model: 'profile-model',
      systemPrompt: null,
    });
    resolvedConnections.fromRecord.mockResolvedValue({
      ...CONNECTION,
      credential: 'plain',
      model: CONVERSATION.modelId,
    });
  });

  it('ưu tiên conversation.modelId hơn model của AI profile', async () => {
    await builder.build('user-1', CONVERSATION.id, 'Hello');

    expect(resolvedConnections.fromRecord).toHaveBeenCalledWith(
      CONNECTION,
      'conversation-model',
    );
  });
});

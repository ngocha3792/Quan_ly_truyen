import { AiAuthType, AiMessageRole, AiProtocol } from '../../../domain/enums';
import { SendAiMessageStreamCommand } from './send-ai-message-stream.command';
import { SendAiMessageStreamCommandHandler } from './send-ai-message-stream.command-handler';
import type { SendAiMessageStreamEvent } from './send-ai-message-stream.view';

describe('SendAiMessageStreamCommandHandler', () => {
  it('chuyển stream chuẩn hóa tới transport rồi persist câu trả lời', async () => {
    const userMessage = {
      id: 'user-message',
      role: AiMessageRole.USER,
      content: 'question',
      createdAt: new Date(0),
    };
    const assistantMessage = {
      id: 'assistant-message',
      role: AiMessageRole.ASSISTANT,
      content: 'answer',
      createdAt: new Date(1),
    };
    const contextBuilder = {
      build: jest.fn().mockResolvedValue({
        conversation: { connectionId: 'connection-id' },
        connection: { id: 'connection-id' },
        resolvedConnection: {
          protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
          vendorHint: 'CUSTOM',
          baseUrl: 'https://gateway.example.com/v1',
          authType: AiAuthType.BEARER,
          authHeaderName: null,
          credential: 'secret',
          model: 'model',
        },
        systemFallback: null,
        systemPrompt: 'system',
        protocolMessages: [{ role: 'user', content: 'question' }],
      }),
    };
    const conversations = {
      appendMessage: jest
        .fn()
        .mockResolvedValueOnce(userMessage)
        .mockResolvedValueOnce(assistantMessage),
      touch: jest.fn(),
    };
    const gateway = {
      generateStream: jest.fn().mockImplementation(async function* () {
        await Promise.resolve();
        yield { type: 'TEXT_DELTA', text: 'answer' } as const;
        yield {
          type: 'USAGE',
          usage: { inputTokens: 10, outputTokens: 2 },
        } as const;
        yield { type: 'DONE' } as const;
      }),
    };
    const handler = new SendAiMessageStreamCommandHandler(
      contextBuilder as never,
      conversations as never,
      gateway as never,
    );

    const events: SendAiMessageStreamEvent[] = [];
    for await (const event of handler.execute(
      new SendAiMessageStreamCommand('user-id', 'conversation-id', 'question'),
    )) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'TEXT_DELTA', text: 'answer' },
      { type: 'USAGE', usage: { inputTokens: 10, outputTokens: 2 } },
      { type: 'DONE', userMessage, assistantMessage },
    ]);
    expect(conversations.appendMessage).toHaveBeenNthCalledWith(
      2,
      'conversation-id',
      AiMessageRole.ASSISTANT,
      'answer',
    );
  });
});

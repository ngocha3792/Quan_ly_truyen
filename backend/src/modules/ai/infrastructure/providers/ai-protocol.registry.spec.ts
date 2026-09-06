import { AiProtocol } from '../../domain/enums';
import { AiProtocolRegistry } from './ai-protocol.registry';

describe('AiProtocolRegistry', () => {
  const openAiResponses = { generate: jest.fn() };
  const openAiChat = { generate: jest.fn() };
  const anthropicMessages = { generate: jest.fn() };
  const geminiGenerateContent = { generate: jest.fn() };
  const config = {
    openai: { model: 'gpt-default' },
    anthropic: { model: 'claude-default' },
    gemini: { model: 'gemini-default' },
  };

  function createRegistry(): AiProtocolRegistry {
    return new AiProtocolRegistry(
      { getOrThrow: jest.fn().mockReturnValue(config) } as never,
      openAiResponses as never,
      openAiChat as never,
      anthropicMessages as never,
      geminiGenerateContent as never,
    );
  }

  it.each([
    [AiProtocol.OPENAI_RESPONSES, openAiResponses],
    [AiProtocol.OPENAI_CHAT_COMPLETIONS, openAiChat],
    [AiProtocol.ANTHROPIC_MESSAGES, anthropicMessages],
    [AiProtocol.GEMINI_GENERATE_CONTENT, geminiGenerateContent],
  ])('dispatch %s theo protocol, không theo vendor', (protocol, adapter) => {
    expect(createRegistry().getAdapter(protocol)).toBe(adapter);
  });

  it('dùng cùng default model OpenAI cho Responses và Chat Completions', () => {
    const registry = createRegistry();

    expect(registry.getDefaultModel(AiProtocol.OPENAI_RESPONSES)).toBe(
      'gpt-default',
    );
    expect(registry.getDefaultModel(AiProtocol.OPENAI_CHAT_COMPLETIONS)).toBe(
      'gpt-default',
    );
  });
});

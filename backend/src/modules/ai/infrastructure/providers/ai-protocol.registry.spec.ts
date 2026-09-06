import { BusinessRuleViolationException } from '@/common/exceptions';

import { AiProtocol } from '../../domain/enums';
import { AiProtocolRegistry } from './ai-protocol.registry';

describe('AiProtocolRegistry', () => {
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
      openAiChat as never,
      anthropicMessages as never,
      geminiGenerateContent as never,
    );
  }

  it.each([
    [AiProtocol.OPENAI_CHAT_COMPLETIONS, openAiChat],
    [AiProtocol.ANTHROPIC_MESSAGES, anthropicMessages],
    [AiProtocol.GEMINI_GENERATE_CONTENT, geminiGenerateContent],
  ])('dispatch %s theo protocol, không theo vendor', (protocol, adapter) => {
    expect(createRegistry().getAdapter(protocol)).toBe(adapter);
  });

  it('nhận diện OPENAI_RESPONSES nhưng từ chối rõ ràng khi chưa có adapter', () => {
    const registry = createRegistry();

    expect(() => registry.getAdapter(AiProtocol.OPENAI_RESPONSES)).toThrow(
      BusinessRuleViolationException,
    );
    expect(registry.getDefaultModel(AiProtocol.OPENAI_RESPONSES)).toBe(
      'gpt-default',
    );
  });
});

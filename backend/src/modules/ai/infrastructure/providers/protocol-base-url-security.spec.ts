import { BusinessRuleViolationException } from '@/common/exceptions';

import { AiAuthType, AiProtocol } from '../../domain/enums';
import type {
  AiProtocolAdapter,
  ResolvedAiConnection,
} from '../../application/ports';
import { AnthropicMessagesProtocolAdapter } from './anthropic-provider.adapter';
import { GeminiGenerateContentProtocolAdapter } from './gemini-provider.adapter';
import { OpenAiChatCompletionsProtocolAdapter } from './openai-compatible-provider.adapter';
import { normalizeProtocolBaseUrl } from './protocol-base-url.util';

const REQUEST = {
  messages: [{ role: 'user' as const, content: 'hello' }],
};

function privateConnection(
  protocol: AiProtocol,
  authType: AiAuthType,
): ResolvedAiConnection {
  return {
    protocol,
    vendorHint: 'UNTRUSTED',
    baseUrl: 'https://127.0.0.1/v1',
    authType,
    authHeaderName:
      authType === AiAuthType.QUERY_PARAM
        ? 'key'
        : authType === AiAuthType.X_API_KEY
          ? 'x-api-key'
          : null,
    credential: 'must-not-be-sent',
    model: 'test-model',
  };
}

describe('protocol adapter base URL security', () => {
  it.each<readonly [string, AiProtocolAdapter, ResolvedAiConnection]>([
    [
      'OpenAI Chat Completions',
      new OpenAiChatCompletionsProtocolAdapter(),
      privateConnection(AiProtocol.OPENAI_CHAT_COMPLETIONS, AiAuthType.BEARER),
    ],
    [
      'Anthropic Messages',
      new AnthropicMessagesProtocolAdapter(),
      privateConnection(AiProtocol.ANTHROPIC_MESSAGES, AiAuthType.X_API_KEY),
    ],
    [
      'Gemini Generate Content',
      new GeminiGenerateContentProtocolAdapter(),
      privateConnection(
        AiProtocol.GEMINI_GENERATE_CONTENT,
        AiAuthType.QUERY_PARAM,
      ),
    ],
  ])(
    '%s chặn private IP trước outbound request',
    async (_name, adapter, connection) => {
      await expect(
        adapter.generate(connection, REQUEST),
      ).rejects.toBeInstanceOf(BusinessRuleViolationException);
    },
  );

  it.each([
    'https://user:password@proxy.example.com',
    'https://proxy.example.com?credential=secret',
    'https://proxy.example.com#fragment',
  ])('chặn thành phần không an toàn trong Base URL: %s', async (baseUrl) => {
    const adapter = new OpenAiChatCompletionsProtocolAdapter();

    await expect(
      adapter.generate(
        {
          ...privateConnection(
            AiProtocol.OPENAI_CHAT_COMPLETIONS,
            AiAuthType.BEARER,
          ),
          baseUrl,
        },
        REQUEST,
      ),
    ).rejects.toBeInstanceOf(BusinessRuleViolationException);
  });
});

describe('normalizeProtocolBaseUrl', () => {
  it('thêm version mặc định khi user chỉ nhập origin', () => {
    expect(
      normalizeProtocolBaseUrl(new URL('https://proxy.example.com'), 'v1'),
    ).toBe('https://proxy.example.com/v1');
  });

  it('giữ nguyên version/path riêng của gateway', () => {
    expect(
      normalizeProtocolBaseUrl(
        new URL('https://proxy.example.com/custom/v2/'),
        'v1',
      ),
    ).toBe('https://proxy.example.com/custom/v2');
  });
});

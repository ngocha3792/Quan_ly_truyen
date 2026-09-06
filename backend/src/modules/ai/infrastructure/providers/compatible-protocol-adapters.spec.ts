import { lookup } from 'node:dns/promises';

import { AiAuthType, AiProtocol } from '../../domain/enums';
import type { ResolvedAiConnection } from '../../application/ports';
import { AnthropicMessagesProtocolAdapter } from './anthropic-provider.adapter';
import { OpenAiChatCompletionsProtocolAdapter } from './openai-compatible-provider.adapter';

jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));

const mockedLookup = jest.mocked(lookup);
const REQUEST = {
  systemPrompt: 'Be concise',
  messages: [{ role: 'user' as const, content: 'Hello' }],
  maxOutputTokens: 256,
};

function parseRequestBody(init?: RequestInit): unknown {
  if (typeof init?.body !== 'string') {
    throw new Error('Expected a JSON string request body');
  }

  return JSON.parse(init.body);
}

function connection(
  overrides: Partial<ResolvedAiConnection>,
): ResolvedAiConnection {
  return {
    protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
    vendorHint: 'CUSTOM_GATEWAY',
    baseUrl: 'https://proxy.example.com',
    authType: AiAuthType.BEARER,
    authHeaderName: null,
    credential: 'secret-value',
    model: 'custom-model',
    ...overrides,
  };
}

describe('compatible protocol adapters', () => {
  beforeEach(() => {
    mockedLookup.mockResolvedValue([
      { address: '1.1.1.1', family: 4 },
    ] as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it('OpenAI-compatible hỗ trợ root base URL và custom auth header', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'OpenAI-compatible result' } }],
          usage: { prompt_tokens: 3, completion_tokens: 2 },
        }),
        { status: 200 },
      ),
    );
    const adapter = new OpenAiChatCompletionsProtocolAdapter();
    const resolved = connection({
      authType: AiAuthType.API_KEY_HEADER,
      authHeaderName: 'X-Gateway-Token',
    });

    await expect(adapter.generate(resolved, REQUEST)).resolves.toMatchObject({
      content: 'OpenAI-compatible result',
      protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
      model: 'custom-model',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://proxy.example.com/v1/chat/completions');
    expect(new Headers(init?.headers).get('X-Gateway-Token')).toBe(
      'secret-value',
    );
    expect(parseRequestBody(init)).toMatchObject({
      model: 'custom-model',
      max_tokens: 256,
    });
  });

  it('GWAI Anthropic-compatible gọi /v1/messages và chỉ ghép text blocks', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [
            { type: 'thinking', thinking: 'must stay hidden' },
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'from GWAI' },
          ],
          usage: { input_tokens: 4, output_tokens: 3 },
        }),
        { status: 200 },
      ),
    );
    const adapter = new AnthropicMessagesProtocolAdapter();
    const resolved = connection({
      protocol: AiProtocol.ANTHROPIC_MESSAGES,
      vendorHint: 'GWAI',
      baseUrl: 'https://1gw.gwai.cloud',
      authType: AiAuthType.X_API_KEY,
      authHeaderName: 'x-api-key',
      model: 'claude-sonnet-5',
    });

    await expect(adapter.generate(resolved, REQUEST)).resolves.toMatchObject({
      content: 'Hello from GWAI',
      protocol: AiProtocol.ANTHROPIC_MESSAGES,
      model: 'claude-sonnet-5',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(url).toBe('https://1gw.gwai.cloud/v1/messages');
    expect(headers.get('x-api-key')).toBe('secret-value');
    expect(headers.get('anthropic-version')).toBe('2023-06-01');
    expect(parseRequestBody(init)).toMatchObject({
      model: 'claude-sonnet-5',
      max_tokens: 256,
    });
  });
});

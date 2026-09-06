import { lookup } from 'node:dns/promises';

import { AiAuthType, AiProtocol } from '../../domain/enums';
import type {
  AiStreamDelta,
  ResolvedAiConnection,
} from '../../application/ports';
import { GeminiGenerateContentProtocolAdapter } from './gemini-provider.adapter';
import { OpenAiResponsesProtocolAdapter } from './openai-responses-provider.adapter';

jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));

const mockedLookup = jest.mocked(lookup);
const REQUEST = {
  systemPrompt: 'Be concise',
  messages: [
    { role: 'user' as const, content: 'Hello' },
    { role: 'assistant' as const, content: 'Hi' },
    { role: 'user' as const, content: 'Summarize this' },
  ],
  maxOutputTokens: 256,
};

function connection(
  protocol: AiProtocol,
  overrides: Partial<ResolvedAiConnection> = {},
): ResolvedAiConnection {
  return {
    protocol,
    vendorHint: protocol,
    baseUrl:
      protocol === AiProtocol.GEMINI_GENERATE_CONTENT
        ? 'https://generativelanguage.googleapis.com/v1beta'
        : 'https://api.openai.com/v1',
    authType:
      protocol === AiProtocol.GEMINI_GENERATE_CONTENT
        ? AiAuthType.QUERY_PARAM
        : AiAuthType.BEARER,
    authHeaderName:
      protocol === AiProtocol.GEMINI_GENERATE_CONTENT ? 'key' : null,
    credential: 'secret-value',
    model:
      protocol === AiProtocol.GEMINI_GENERATE_CONTENT
        ? 'gemini-test'
        : 'gpt-test',
    ...overrides,
  };
}

function requestBody(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== 'string') {
    throw new Error('Expected JSON request body');
  }
  return JSON.parse(init.body) as Record<string, unknown>;
}

describe('native protocol adapters', () => {
  beforeEach(() => {
    mockedLookup.mockResolvedValue([
      { address: '1.1.1.1', family: 4 },
    ] as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it('OpenAI Responses normalize request, output_text và usage', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'completed',
          output_text: 'Responses result',
          usage: { input_tokens: 12, output_tokens: 4 },
        }),
        { status: 200 },
      ),
    );
    const adapter = new OpenAiResponsesProtocolAdapter();
    const resolved = connection(AiProtocol.OPENAI_RESPONSES);

    await expect(adapter.generate(resolved, REQUEST)).resolves.toMatchObject({
      content: 'Responses result',
      protocol: AiProtocol.OPENAI_RESPONSES,
      model: 'gpt-test',
      usage: { inputTokens: 12, outputTokens: 4 },
    });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer secret-value',
    );
    expect(requestBody(init)).toMatchObject({
      model: 'gpt-test',
      instructions: 'Be concise',
      input: REQUEST.messages,
      max_output_tokens: 256,
      stream: false,
      store: false,
    });
  });

  it('OpenAI Responses chỉ stream text delta và normalize usage khi complete', async () => {
    const events = [
      'event: response.created\ndata: {"type":"response.created"}',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hello "}',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"world"}',
      'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":5,"output_tokens":2}}}',
    ].join('\n\n');
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(`${events}\n\n`, { status: 200 }));
    const adapter = new OpenAiResponsesProtocolAdapter();

    const chunks: AiStreamDelta[] = [];
    for await (const chunk of adapter.generateStream(
      connection(AiProtocol.OPENAI_RESPONSES),
      REQUEST,
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { text: 'Hello ' },
      { text: 'world' },
      { usage: { inputTokens: 5, outputTokens: 2 } },
    ]);
  });

  it('OpenAI Responses chỉ ghép output_text từ raw output items', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'completed',
          output: [
            {
              type: 'reasoning',
              content: [{ type: 'summary_text', text: 'hidden' }],
            },
            {
              type: 'message',
              content: [
                { type: 'output_text', text: 'Visible ' },
                { type: 'refusal', text: 'not copied' },
                { type: 'output_text', text: 'answer' },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(
      new OpenAiResponsesProtocolAdapter().generate(
        connection(AiProtocol.OPENAI_RESPONSES),
        REQUEST,
      ),
    ).resolves.toMatchObject({ content: 'Visible answer' });
  });

  it('Gemini native dùng generateContent, query auth và systemInstruction', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: 'Gemini ' }, { text: 'result' }] } },
          ],
          usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 3 },
        }),
        { status: 200 },
      ),
    );
    const adapter = new GeminiGenerateContentProtocolAdapter();
    const resolved = connection(AiProtocol.GEMINI_GENERATE_CONTENT);

    await expect(adapter.generate(resolved, REQUEST)).resolves.toMatchObject({
      content: 'Gemini result',
      protocol: AiProtocol.GEMINI_GENERATE_CONTENT,
      model: 'gemini-test',
      usage: { inputTokens: 8, outputTokens: 3 },
    });

    const [rawUrl, init] = fetchSpy.mock.calls[0];
    const url = new URL(
      typeof rawUrl === 'string'
        ? rawUrl
        : rawUrl instanceof URL
          ? rawUrl.href
          : rawUrl.url,
    );
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent',
    );
    expect(url.searchParams.get('key')).toBe('secret-value');
    expect(requestBody(init)).toMatchObject({
      systemInstruction: { parts: [{ text: 'Be concise' }] },
      generationConfig: { maxOutputTokens: 256 },
    });
  });
});

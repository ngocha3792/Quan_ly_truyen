import {
  ResolvedAiConnection,
  AiConnectionTestResult,
  AiGenerateRequest,
  AiGenerateResponse,
  AiModelInfo,
  AiMessage,
  AiProtocolRequestError,
  AiStreamEvent,
} from '../../application/ports/ai-protocol-adapter.port';
import {
  AI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_PROVIDER_REQUEST_TIMEOUT_MS,
  AI_STREAM_TIMEOUT_MS,
} from '../../application/constants/ai-generation.constants';
import {
  readBodyWithLimit,
  safeExternalFetch,
} from '../security/ssrf-guard.util';
import {
  extractSseDataLines,
  readSseEventBlocks,
  safeJsonParse,
} from './sse-reader.util';
import { applyAiCredential } from './ai-auth.util';
import { resolveProviderTimeoutMs } from './provider-request-timeout.util';
import {
  sanitizeProviderErrorMessage,
  toProviderTransportError,
} from './provider-error.util';

function buildMessages(request: AiGenerateRequest): AiMessage[] {
  const messages: AiMessage[] = [];
  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }
  messages.push(...request.messages);
  return messages;
}

interface UsagePayload {
  prompt_tokens?: number;
  completion_tokens?: number;
}

interface ChatCompletionPayload {
  choices?: { message?: { content?: string } }[];
  usage?: UsagePayload;
  error?: { message?: string };
}

interface ChatCompletionStreamChunkPayload {
  choices?: { delta?: { content?: string } }[];
  usage?: UsagePayload;
}

interface ModelListPayload {
  data?: {
    id?: string;
    name?: string;
    display_name?: string;
    context_length?: number;
    max_output_tokens?: number;
    capabilities?: {
      reasoning?: boolean;
      vision?: boolean;
      tools?: boolean;
    };
  }[];
  error?: { message?: string };
}

export async function openAiCompatibleGenerate(
  connection: ResolvedAiConnection,
  request: AiGenerateRequest,
  baseUrl: string,
): Promise<AiGenerateResponse> {
  const startedAt = Date.now();
  let response: Response;

  try {
    const authenticated = applyAiCredential(
      connection,
      `${baseUrl}/chat/completions`,
      { 'Content-Type': 'application/json' },
    );
    response = await safeExternalFetch(authenticated.url, {
      method: 'POST',
      headers: authenticated.headers,
      body: JSON.stringify({
        model: connection.model,
        messages: buildMessages(request),
        temperature: request.temperature,
        max_tokens: request.maxOutputTokens ?? AI_DEFAULT_MAX_OUTPUT_TOKENS,
      }),
      signal: AbortSignal.timeout(
        resolveProviderTimeoutMs(
          request.timeoutMs,
          AI_PROVIDER_REQUEST_TIMEOUT_MS,
          AI_PROVIDER_REQUEST_TIMEOUT_MS,
        ),
      ),
    });
  } catch (error) {
    throw toProviderTransportError(error, 'máy chủ AI');
  }

  const body = await readBodyWithLimit(response);
  const payload = safeJsonParse<ChatCompletionPayload>(body);

  if (!response.ok) {
    throw new AiProtocolRequestError(
      sanitizeProviderErrorMessage(
        payload?.error?.message,
        connection.credential,
        `Máy chủ AI trả về lỗi ${response.status}`,
      ),
      response.status,
    );
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiProtocolRequestError(
      'Máy chủ AI không trả về nội dung phản hồi',
      response.status,
    );
  }

  return {
    content,
    protocol: connection.protocol,
    model: connection.model,
    latencyMs: Date.now() - startedAt,
    usage: payload?.usage
      ? {
          inputTokens: payload.usage.prompt_tokens,
          outputTokens: payload.usage.completion_tokens,
        }
      : undefined,
  };
}

export async function* openAiCompatibleGenerateStream(
  connection: ResolvedAiConnection,
  request: AiGenerateRequest,
  baseUrl: string,
): AsyncIterable<AiStreamEvent> {
  let response: Response;

  try {
    const authenticated = applyAiCredential(
      connection,
      `${baseUrl}/chat/completions`,
      { 'Content-Type': 'application/json' },
    );
    response = await safeExternalFetch(authenticated.url, {
      method: 'POST',
      headers: authenticated.headers,
      body: JSON.stringify({
        model: connection.model,
        messages: buildMessages(request),
        temperature: request.temperature,
        max_tokens: request.maxOutputTokens ?? AI_DEFAULT_MAX_OUTPUT_TOKENS,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: AbortSignal.timeout(
        resolveProviderTimeoutMs(
          request.timeoutMs,
          AI_STREAM_TIMEOUT_MS,
          AI_STREAM_TIMEOUT_MS,
        ),
      ),
    });
  } catch (error) {
    throw toProviderTransportError(error, 'máy chủ AI');
  }

  if (!response.ok) {
    const body = await readBodyWithLimit(response);
    const payload = safeJsonParse<ChatCompletionPayload>(body);
    throw new AiProtocolRequestError(
      sanitizeProviderErrorMessage(
        payload?.error?.message,
        connection.credential,
        `Máy chủ AI trả về lỗi ${response.status}`,
      ),
      response.status,
    );
  }

  for await (const eventBlock of readSseEventBlocks(response)) {
    for (const data of extractSseDataLines(eventBlock)) {
      if (data === '[DONE]') {
        yield { type: 'DONE' };
        return;
      }

      const chunk = safeJsonParse<ChatCompletionStreamChunkPayload>(data);
      const text = chunk?.choices?.[0]?.delta?.content;
      if (text) yield { type: 'TEXT_DELTA', text };

      if (chunk?.usage) {
        yield {
          type: 'USAGE',
          usage: {
            inputTokens: chunk.usage.prompt_tokens,
            outputTokens: chunk.usage.completion_tokens,
          },
        };
      }
    }
  }

  yield { type: 'DONE' };
}

export async function openAiCompatibleListModels(
  connection: ResolvedAiConnection,
  baseUrl: string,
): Promise<readonly AiModelInfo[]> {
  let response: Response;

  try {
    const authenticated = applyAiCredential(connection, `${baseUrl}/models`);
    response = await safeExternalFetch(authenticated.url, {
      method: 'GET',
      headers: authenticated.headers,
      signal: AbortSignal.timeout(AI_PROVIDER_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw toProviderTransportError(error, 'máy chủ AI');
  }

  const body = await readBodyWithLimit(response);
  const payload = safeJsonParse<ModelListPayload>(body);

  if (!response.ok) {
    throw new AiProtocolRequestError(
      sanitizeProviderErrorMessage(
        payload?.error?.message,
        connection.credential,
        `Máy chủ AI trả về lỗi ${response.status}`,
      ),
      response.status,
    );
  }

  return (payload?.data ?? []).flatMap((item) => {
    if (!item.id) return [];
    return [
      {
        id: item.id,
        ...(item.display_name || item.name
          ? { displayName: item.display_name ?? item.name }
          : {}),
        ...(item.context_length !== undefined
          ? { contextLength: item.context_length }
          : {}),
        ...(item.max_output_tokens !== undefined
          ? { maxOutputTokens: item.max_output_tokens }
          : {}),
        ...(item.capabilities?.reasoning !== undefined
          ? { reasoning: item.capabilities.reasoning }
          : {}),
        ...(item.capabilities?.vision !== undefined
          ? { vision: item.capabilities.vision }
          : {}),
        ...(item.capabilities?.tools !== undefined
          ? { tools: item.capabilities.tools }
          : {}),
      },
    ];
  });
}

export async function openAiCompatibleTestConnection(
  connection: ResolvedAiConnection,
  baseUrl: string,
): Promise<AiConnectionTestResult> {
  try {
    await openAiCompatibleListModels(connection, baseUrl);
    return { ok: true };
  } catch (error) {
    if (error instanceof AiProtocolRequestError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: (error as Error).message };
  }
}

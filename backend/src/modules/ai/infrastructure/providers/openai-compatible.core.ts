import {
  ResolvedAiConnection,
  AiConnectionTestResult,
  AiGenerateRequest,
  AiGenerateResponse,
  AiMessage,
  AiProtocolRequestError,
  AiStreamDelta,
} from '../../application/ports/ai-protocol-adapter.port';
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

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 1024;

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
  data?: { id?: string }[];
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
        max_tokens: request.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new AiProtocolRequestError(
      `Không thể kết nối tới máy chủ AI: ${(error as Error).message}`,
      null,
    );
  }

  const body = await readBodyWithLimit(response);
  const payload = safeJsonParse<ChatCompletionPayload>(body);

  if (!response.ok) {
    throw new AiProtocolRequestError(
      payload?.error?.message ?? `Máy chủ AI trả về lỗi ${response.status}`,
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
): AsyncIterable<AiStreamDelta> {
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
        max_tokens: request.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new AiProtocolRequestError(
      `Không thể kết nối tới máy chủ AI: ${(error as Error).message}`,
      null,
    );
  }

  if (!response.ok) {
    const body = await readBodyWithLimit(response);
    const payload = safeJsonParse<ChatCompletionPayload>(body);
    throw new AiProtocolRequestError(
      payload?.error?.message ?? `Máy chủ AI trả về lỗi ${response.status}`,
      response.status,
    );
  }

  for await (const eventBlock of readSseEventBlocks(response)) {
    for (const data of extractSseDataLines(eventBlock)) {
      if (data === '[DONE]') return;

      const chunk = safeJsonParse<ChatCompletionStreamChunkPayload>(data);
      const text = chunk?.choices?.[0]?.delta?.content;
      if (text) yield { text };

      if (chunk?.usage) {
        yield {
          usage: {
            inputTokens: chunk.usage.prompt_tokens,
            outputTokens: chunk.usage.completion_tokens,
          },
        };
      }
    }
  }
}

export async function openAiCompatibleListModels(
  connection: ResolvedAiConnection,
  baseUrl: string,
): Promise<readonly string[]> {
  let response: Response;

  try {
    const authenticated = applyAiCredential(connection, `${baseUrl}/models`);
    response = await safeExternalFetch(authenticated.url, {
      method: 'GET',
      headers: authenticated.headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new AiProtocolRequestError(
      `Không thể kết nối tới máy chủ AI: ${(error as Error).message}`,
      null,
    );
  }

  const body = await readBodyWithLimit(response);
  const payload = safeJsonParse<ModelListPayload>(body);

  if (!response.ok) {
    throw new AiProtocolRequestError(
      payload?.error?.message ?? `Máy chủ AI trả về lỗi ${response.status}`,
      response.status,
    );
  }

  return (payload?.data ?? [])
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id));
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

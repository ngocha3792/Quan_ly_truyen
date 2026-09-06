import { Injectable } from '@nestjs/common';

import {
  ResolvedAiConnection,
  AiConnectionTestResult,
  AiGenerateRequest,
  AiGenerateResponse,
  AiProtocolAdapter,
  AiProtocolRequestError,
  AiStreamDelta,
} from '../../application/ports/ai-protocol-adapter.port';
import {
  assertPublicHttpsUrl,
  safeExternalFetch,
} from '../security/ssrf-guard.util';
import { applyAiCredential } from './ai-auth.util';
import {
  extractSseDataLines,
  extractSseEventName,
  readSseEventBlocks,
  safeJsonParse,
} from './sse-reader.util';

const ANTHROPIC_API_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 1024;

interface UsagePayload {
  input_tokens?: number;
  output_tokens?: number;
}

interface MessagesPayload {
  content?: { type?: string; text?: string }[];
  usage?: UsagePayload;
  error?: { message?: string };
}

interface MessageStartEventPayload {
  message?: { usage?: UsagePayload };
}

interface ContentBlockDeltaEventPayload {
  delta?: { type?: string; text?: string };
}

interface MessageDeltaEventPayload {
  usage?: UsagePayload;
}

interface ListModelsPayload {
  data?: { id?: string }[];
  error?: { message?: string };
}

function buildRequestBody(
  connection: ResolvedAiConnection,
  request: AiGenerateRequest,
  stream: boolean,
) {
  return {
    model: connection.model,
    max_tokens: request.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
    stream,
    ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
    ...(request.temperature !== undefined
      ? { temperature: request.temperature }
      : {}),
    messages: request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({ role: message.role, content: message.content })),
  };
}

@Injectable()
export class AnthropicMessagesProtocolAdapter implements AiProtocolAdapter {
  async generate(
    connection: ResolvedAiConnection,
    request: AiGenerateRequest,
  ): Promise<AiGenerateResponse> {
    const startedAt = Date.now();
    const baseUrl = await this.requireGuardedBaseUrl(connection);
    let response: Response;

    try {
      const authenticated = applyAiCredential(
        connection,
        `${baseUrl}/messages`,
        {
          'anthropic-version': ANTHROPIC_API_VERSION,
          'Content-Type': 'application/json',
        },
      );
      response = await safeExternalFetch(authenticated.url, {
        method: 'POST',
        headers: authenticated.headers,
        body: JSON.stringify(buildRequestBody(connection, request, false)),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AiProtocolRequestError(
        `Không thể kết nối tới Anthropic: ${(error as Error).message}`,
        null,
      );
    }

    const payload = (await response
      .json()
      .catch(() => null)) as MessagesPayload | null;

    if (!response.ok) {
      throw new AiProtocolRequestError(
        payload?.error?.message ?? `Anthropic trả về lỗi ${response.status}`,
        response.status,
      );
    }

    const text = payload?.content?.find((block) => block.type === 'text')?.text;
    if (!text) {
      throw new AiProtocolRequestError(
        'Anthropic không trả về nội dung phản hồi',
        response.status,
      );
    }

    return {
      content: text,
      protocol: connection.protocol,
      model: connection.model,
      latencyMs: Date.now() - startedAt,
      usage: payload?.usage
        ? {
            inputTokens: payload.usage.input_tokens,
            outputTokens: payload.usage.output_tokens,
          }
        : undefined,
    };
  }

  async *generateStream(
    connection: ResolvedAiConnection,
    request: AiGenerateRequest,
  ): AsyncIterable<AiStreamDelta> {
    const baseUrl = await this.requireGuardedBaseUrl(connection);
    let response: Response;

    try {
      const authenticated = applyAiCredential(
        connection,
        `${baseUrl}/messages`,
        {
          'anthropic-version': ANTHROPIC_API_VERSION,
          'Content-Type': 'application/json',
        },
      );
      response = await safeExternalFetch(authenticated.url, {
        method: 'POST',
        headers: authenticated.headers,
        body: JSON.stringify(buildRequestBody(connection, request, true)),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AiProtocolRequestError(
        `Không thể kết nối tới Anthropic: ${(error as Error).message}`,
        null,
      );
    }

    if (!response.ok) {
      const payload = (await response
        .json()
        .catch(() => null)) as MessagesPayload | null;
      throw new AiProtocolRequestError(
        payload?.error?.message ?? `Anthropic trả về lỗi ${response.status}`,
        response.status,
      );
    }

    let inputTokens: number | undefined;

    for await (const eventBlock of readSseEventBlocks(response)) {
      const eventName = extractSseEventName(eventBlock);

      for (const data of extractSseDataLines(eventBlock)) {
        if (eventName === 'message_start') {
          const chunk = safeJsonParse<MessageStartEventPayload>(data);
          inputTokens = chunk?.message?.usage?.input_tokens;
          continue;
        }

        if (eventName === 'content_block_delta') {
          const chunk = safeJsonParse<ContentBlockDeltaEventPayload>(data);
          if (chunk?.delta?.type === 'text_delta' && chunk.delta.text) {
            yield { text: chunk.delta.text };
          }
          continue;
        }

        if (eventName === 'message_delta') {
          const chunk = safeJsonParse<MessageDeltaEventPayload>(data);
          if (chunk?.usage?.output_tokens !== undefined) {
            yield {
              usage: { inputTokens, outputTokens: chunk.usage.output_tokens },
            };
          }
        }
      }
    }
  }

  async testConnection(
    connection: ResolvedAiConnection,
  ): Promise<AiConnectionTestResult> {
    try {
      await this.listModels(connection);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Không thể kết nối',
      };
    }
  }

  async listModels(
    connection: ResolvedAiConnection,
  ): Promise<readonly string[]> {
    const baseUrl = await this.requireGuardedBaseUrl(connection);
    let response: Response;

    try {
      const authenticated = applyAiCredential(connection, `${baseUrl}/models`, {
        'anthropic-version': ANTHROPIC_API_VERSION,
      });
      response = await safeExternalFetch(authenticated.url, {
        headers: authenticated.headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AiProtocolRequestError(
        `Không thể kết nối tới Anthropic: ${(error as Error).message}`,
        null,
      );
    }

    const payload = (await response
      .json()
      .catch(() => null)) as ListModelsPayload | null;

    if (!response.ok) {
      throw new AiProtocolRequestError(
        payload?.error?.message ?? `Anthropic trả về lỗi ${response.status}`,
        response.status,
      );
    }

    return (payload?.data ?? [])
      .map((model) => model.id)
      .filter((id): id is string => Boolean(id));
  }

  private async requireGuardedBaseUrl(
    connection: ResolvedAiConnection,
  ): Promise<string> {
    const url = await assertPublicHttpsUrl(connection.baseUrl);
    return url.toString().replace(/\/+$/, '');
  }
}

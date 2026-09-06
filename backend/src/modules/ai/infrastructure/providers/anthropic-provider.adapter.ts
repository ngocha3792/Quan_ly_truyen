import { Injectable } from '@nestjs/common';

import {
  ResolvedAiConnection,
  AiConnectionTestResult,
  AiGenerateRequest,
  AiGenerateResponse,
  AiModelInfo,
  AiProtocolAdapter,
  AiProtocolRequestError,
  AiStreamEvent,
} from '../../application/ports/ai-protocol-adapter.port';
import {
  AI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_PROVIDER_REQUEST_TIMEOUT_MS,
  AI_STREAM_TIMEOUT_MS,
} from '../../application/constants/ai-generation.constants';
import {
  assertPublicHttpsUrl,
  readBodyWithLimit,
  safeExternalFetch,
} from '../security/ssrf-guard.util';
import { applyAiCredential } from './ai-auth.util';
import {
  extractSseDataLines,
  extractSseEventName,
  readSseEventBlocks,
  safeJsonParse,
} from './sse-reader.util';
import { normalizeProtocolBaseUrl } from './protocol-base-url.util';
import { resolveProviderTimeoutMs } from './provider-request-timeout.util';
import {
  sanitizeProviderErrorMessage,
  toProviderTransportError,
} from './provider-error.util';

const ANTHROPIC_API_VERSION = '2023-06-01';
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
  data?: { id?: string; display_name?: string }[];
  error?: { message?: string };
}

function buildRequestBody(
  connection: ResolvedAiConnection,
  request: AiGenerateRequest,
  stream: boolean,
) {
  return {
    model: connection.model,
    max_tokens: request.maxOutputTokens ?? AI_DEFAULT_MAX_OUTPUT_TOKENS,
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
        signal: AbortSignal.timeout(
          resolveProviderTimeoutMs(
            request.timeoutMs,
            AI_PROVIDER_REQUEST_TIMEOUT_MS,
            AI_PROVIDER_REQUEST_TIMEOUT_MS,
          ),
        ),
      });
    } catch (error) {
      throw toProviderTransportError(error, 'Anthropic');
    }

    const payload = safeJsonParse<MessagesPayload>(
      await readBodyWithLimit(response),
    );

    if (!response.ok) {
      throw new AiProtocolRequestError(
        sanitizeProviderErrorMessage(
          payload?.error?.message,
          connection.credential,
          `Anthropic trả về lỗi ${response.status}`,
        ),
        response.status,
      );
    }

    const text = (payload?.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');
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
  ): AsyncIterable<AiStreamEvent> {
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
        signal: AbortSignal.timeout(
          resolveProviderTimeoutMs(
            request.timeoutMs,
            AI_STREAM_TIMEOUT_MS,
            AI_STREAM_TIMEOUT_MS,
          ),
        ),
      });
    } catch (error) {
      throw toProviderTransportError(error, 'Anthropic');
    }

    if (!response.ok) {
      const payload = safeJsonParse<MessagesPayload>(
        await readBodyWithLimit(response),
      );
      throw new AiProtocolRequestError(
        sanitizeProviderErrorMessage(
          payload?.error?.message,
          connection.credential,
          `Anthropic trả về lỗi ${response.status}`,
        ),
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
            yield { type: 'TEXT_DELTA', text: chunk.delta.text };
          }
          continue;
        }

        if (eventName === 'message_delta') {
          const chunk = safeJsonParse<MessageDeltaEventPayload>(data);
          if (chunk?.usage?.output_tokens !== undefined) {
            yield {
              type: 'USAGE',
              usage: { inputTokens, outputTokens: chunk.usage.output_tokens },
            };
          }
          continue;
        }

        if (eventName === 'message_stop') {
          yield { type: 'DONE' };
          return;
        }
      }
    }

    yield { type: 'DONE' };
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
  ): Promise<readonly AiModelInfo[]> {
    const baseUrl = await this.requireGuardedBaseUrl(connection);
    let response: Response;

    try {
      const authenticated = applyAiCredential(connection, `${baseUrl}/models`, {
        'anthropic-version': ANTHROPIC_API_VERSION,
      });
      response = await safeExternalFetch(authenticated.url, {
        headers: authenticated.headers,
        signal: AbortSignal.timeout(AI_PROVIDER_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw toProviderTransportError(error, 'Anthropic');
    }

    const payload = safeJsonParse<ListModelsPayload>(
      await readBodyWithLimit(response),
    );

    if (!response.ok) {
      throw new AiProtocolRequestError(
        sanitizeProviderErrorMessage(
          payload?.error?.message,
          connection.credential,
          `Anthropic trả về lỗi ${response.status}`,
        ),
        response.status,
      );
    }

    return (payload?.data ?? []).flatMap((model) =>
      model.id
        ? [
            {
              id: model.id,
              ...(model.display_name
                ? { displayName: model.display_name }
                : {}),
            },
          ]
        : [],
    );
  }

  private async requireGuardedBaseUrl(
    connection: ResolvedAiConnection,
  ): Promise<string> {
    const url = await assertPublicHttpsUrl(connection.baseUrl);
    return normalizeProtocolBaseUrl(url, 'v1');
  }
}

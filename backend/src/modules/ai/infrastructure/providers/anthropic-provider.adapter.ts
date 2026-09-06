import { Injectable } from '@nestjs/common';

import {
  AiConnectionConfig,
  AiConnectionTestResult,
  AiGenerateRequest,
  AiGenerateResponse,
  AiProviderClientPort,
  AiProviderRequestError,
  AiStreamDelta,
} from '../../application/ports/ai-provider-client.port';
import {
  extractSseDataLines,
  extractSseEventName,
  readSseEventBlocks,
  safeJsonParse,
} from './sse-reader.util';

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
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
  config: AiConnectionConfig,
  request: AiGenerateRequest,
  stream: boolean,
) {
  return {
    model: config.model,
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
export class AnthropicProviderAdapter implements AiProviderClientPort {
  async generate(
    config: AiConnectionConfig,
    request: AiGenerateRequest,
  ): Promise<AiGenerateResponse> {
    const startedAt = Date.now();
    let response: Response;

    try {
      response = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildRequestBody(config, request, false)),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AiProviderRequestError(
        `Không thể kết nối tới Anthropic: ${(error as Error).message}`,
        null,
      );
    }

    const payload = (await response
      .json()
      .catch(() => null)) as MessagesPayload | null;

    if (!response.ok) {
      throw new AiProviderRequestError(
        payload?.error?.message ?? `Anthropic trả về lỗi ${response.status}`,
        response.status,
      );
    }

    const text = payload?.content?.find((block) => block.type === 'text')?.text;
    if (!text) {
      throw new AiProviderRequestError(
        'Anthropic không trả về nội dung phản hồi',
        response.status,
      );
    }

    return {
      content: text,
      provider: config.provider,
      model: config.model,
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
    config: AiConnectionConfig,
    request: AiGenerateRequest,
  ): AsyncIterable<AiStreamDelta> {
    let response: Response;

    try {
      response = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildRequestBody(config, request, true)),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AiProviderRequestError(
        `Không thể kết nối tới Anthropic: ${(error as Error).message}`,
        null,
      );
    }

    if (!response.ok) {
      const payload = (await response
        .json()
        .catch(() => null)) as MessagesPayload | null;
      throw new AiProviderRequestError(
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
    config: AiConnectionConfig,
  ): Promise<AiConnectionTestResult> {
    try {
      await this.listModels(config);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Không thể kết nối',
      };
    }
  }

  async listModels(config: AiConnectionConfig): Promise<readonly string[]> {
    let response: Response;

    try {
      response = await fetch(`${ANTHROPIC_BASE_URL}/models`, {
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AiProviderRequestError(
        `Không thể kết nối tới Anthropic: ${(error as Error).message}`,
        null,
      );
    }

    const payload = (await response
      .json()
      .catch(() => null)) as ListModelsPayload | null;

    if (!response.ok) {
      throw new AiProviderRequestError(
        payload?.error?.message ?? `Anthropic trả về lỗi ${response.status}`,
        response.status,
      );
    }

    return (payload?.data ?? [])
      .map((model) => model.id)
      .filter((id): id is string => Boolean(id));
  }
}

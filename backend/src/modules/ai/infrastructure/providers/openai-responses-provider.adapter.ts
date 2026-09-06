import { Injectable } from '@nestjs/common';

import {
  AiConnectionTestResult,
  AiGenerateRequest,
  AiGenerateResponse,
  AiModelInfo,
  AiProtocolAdapter,
  AiProtocolRequestError,
  AiStreamDelta,
  ResolvedAiConnection,
} from '../../application/ports/ai-protocol-adapter.port';
import {
  assertPublicHttpsUrl,
  readBodyWithLimit,
  safeExternalFetch,
} from '../security/ssrf-guard.util';
import { applyAiCredential } from './ai-auth.util';
import {
  openAiCompatibleListModels,
  openAiCompatibleTestConnection,
} from './openai-compatible.core';
import { normalizeProtocolBaseUrl } from './protocol-base-url.util';
import {
  extractSseDataLines,
  readSseEventBlocks,
  safeJsonParse,
} from './sse-reader.util';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 4096;

interface ResponsesUsagePayload {
  input_tokens?: number;
  output_tokens?: number;
}

interface ResponsesPayload {
  status?: string;
  output_text?: string;
  output?: {
    type?: string;
    content?: { type?: string; text?: string }[];
  }[];
  usage?: ResponsesUsagePayload;
  error?: { message?: string };
  incomplete_details?: { reason?: string };
}

interface ResponsesStreamPayload {
  type?: string;
  delta?: string;
  response?: ResponsesPayload;
  error?: { message?: string };
}

function buildRequestBody(request: AiGenerateRequest, stream: boolean) {
  return {
    input: request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    ...(request.systemPrompt ? { instructions: request.systemPrompt } : {}),
    max_output_tokens: request.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
    ...(request.temperature !== undefined
      ? { temperature: request.temperature }
      : {}),
    stream,
    store: false,
  };
}

function extractOutputText(payload: ResponsesPayload | null): string {
  if (payload?.output_text) return payload.output_text;

  return (payload?.output ?? [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text ?? '')
    .join('');
}

function toUsage(usage: ResponsesUsagePayload | undefined) {
  if (!usage) return undefined;
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  };
}

@Injectable()
export class OpenAiResponsesProtocolAdapter implements AiProtocolAdapter {
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
        `${baseUrl}/responses`,
        { 'Content-Type': 'application/json' },
      );
      response = await safeExternalFetch(authenticated.url, {
        method: 'POST',
        headers: authenticated.headers,
        body: JSON.stringify({
          model: connection.model,
          ...buildRequestBody(request, false),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AiProtocolRequestError(
        `Không thể kết nối tới OpenAI Responses: ${(error as Error).message}`,
        null,
      );
    }

    const body = await readBodyWithLimit(response);
    const payload = safeJsonParse<ResponsesPayload>(body);

    if (!response.ok) {
      throw new AiProtocolRequestError(
        payload?.error?.message ?? `OpenAI trả về lỗi ${response.status}`,
        response.status,
      );
    }

    const content = extractOutputText(payload);
    if (!content) {
      const detail =
        payload?.error?.message ?? payload?.incomplete_details?.reason;
      throw new AiProtocolRequestError(
        detail
          ? `OpenAI Responses không hoàn tất: ${detail}`
          : 'OpenAI Responses không trả về nội dung phản hồi',
        response.status,
      );
    }

    return {
      content,
      protocol: connection.protocol,
      model: connection.model,
      latencyMs: Date.now() - startedAt,
      usage: toUsage(payload?.usage),
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
        `${baseUrl}/responses`,
        { 'Content-Type': 'application/json' },
      );
      response = await safeExternalFetch(authenticated.url, {
        method: 'POST',
        headers: authenticated.headers,
        body: JSON.stringify({
          model: connection.model,
          ...buildRequestBody(request, true),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AiProtocolRequestError(
        `Không thể kết nối tới OpenAI Responses: ${(error as Error).message}`,
        null,
      );
    }

    if (!response.ok) {
      const body = await readBodyWithLimit(response);
      const payload = safeJsonParse<ResponsesPayload>(body);
      throw new AiProtocolRequestError(
        payload?.error?.message ?? `OpenAI trả về lỗi ${response.status}`,
        response.status,
      );
    }

    for await (const eventBlock of readSseEventBlocks(response)) {
      for (const data of extractSseDataLines(eventBlock)) {
        if (data === '[DONE]') return;
        const event = safeJsonParse<ResponsesStreamPayload>(data);

        if (event?.type === 'response.output_text.delta' && event.delta) {
          yield { text: event.delta };
          continue;
        }

        if (
          event?.type === 'response.completed' ||
          event?.type === 'response.incomplete'
        ) {
          const usage = toUsage(event.response?.usage);
          if (usage) yield { usage };
          return;
        }

        if (event?.type === 'response.failed' || event?.type === 'error') {
          throw new AiProtocolRequestError(
            event.error?.message ??
              event.response?.error?.message ??
              'OpenAI Responses stream thất bại',
            response.status,
          );
        }
      }
    }
  }

  async testConnection(
    connection: ResolvedAiConnection,
  ): Promise<AiConnectionTestResult> {
    const baseUrl = await this.requireGuardedBaseUrl(connection);
    return openAiCompatibleTestConnection(connection, baseUrl);
  }

  async listModels(
    connection: ResolvedAiConnection,
  ): Promise<readonly AiModelInfo[]> {
    const baseUrl = await this.requireGuardedBaseUrl(connection);
    return openAiCompatibleListModels(connection, baseUrl);
  }

  private async requireGuardedBaseUrl(
    connection: ResolvedAiConnection,
  ): Promise<string> {
    const url = await assertPublicHttpsUrl(connection.baseUrl);
    return normalizeProtocolBaseUrl(url, 'v1');
  }
}

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
  safeExternalFetch,
} from '../security/ssrf-guard.util';
import { applyAiCredential } from './ai-auth.util';
import {
  extractSseDataLines,
  readSseEventBlocks,
  safeJsonParse,
} from './sse-reader.util';
import { normalizeProtocolBaseUrl } from './protocol-base-url.util';

interface UsageMetadataPayload {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
}

interface GenerateContentPayload {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: UsageMetadataPayload;
  error?: { message?: string };
}

interface ListModelsPayload {
  models?: {
    name?: string;
    displayName?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
  }[];
  error?: { message?: string };
}

function buildContents(request: AiGenerateRequest) {
  return request.messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));
}

function buildRequestBody(request: AiGenerateRequest) {
  return {
    ...(request.systemPrompt
      ? { systemInstruction: { parts: [{ text: request.systemPrompt }] } }
      : {}),
    contents: buildContents(request),
    generationConfig: {
      maxOutputTokens: request.maxOutputTokens ?? AI_DEFAULT_MAX_OUTPUT_TOKENS,
      ...(request.temperature !== undefined
        ? { temperature: request.temperature }
        : {}),
    },
  };
}

function toUsage(usage: UsageMetadataPayload | undefined) {
  if (!usage) return undefined;
  return {
    inputTokens: usage.promptTokenCount,
    outputTokens: usage.candidatesTokenCount,
  };
}

@Injectable()
export class GeminiGenerateContentProtocolAdapter implements AiProtocolAdapter {
  async generate(
    connection: ResolvedAiConnection,
    request: AiGenerateRequest,
  ): Promise<AiGenerateResponse> {
    const startedAt = Date.now();
    const baseUrl = await this.requireGuardedBaseUrl(connection);
    const url = `${baseUrl}/models/${encodeURIComponent(connection.model)}:generateContent`;

    let response: Response;

    try {
      const authenticated = applyAiCredential(connection, url, {
        'Content-Type': 'application/json',
      });
      response = await safeExternalFetch(authenticated.url, {
        method: 'POST',
        headers: authenticated.headers,
        body: JSON.stringify(buildRequestBody(request)),
        signal: AbortSignal.timeout(AI_PROVIDER_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AiProtocolRequestError(
        `Không thể kết nối tới Gemini: ${(error as Error).message}`,
        null,
      );
    }

    const payload = (await response
      .json()
      .catch(() => null)) as GenerateContentPayload | null;

    if (!response.ok) {
      throw new AiProtocolRequestError(
        payload?.error?.message ?? `Gemini trả về lỗi ${response.status}`,
        response.status,
      );
    }

    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('');
    if (!text) {
      throw new AiProtocolRequestError(
        'Gemini không trả về nội dung phản hồi',
        response.status,
      );
    }

    return {
      content: text,
      protocol: connection.protocol,
      model: connection.model,
      latencyMs: Date.now() - startedAt,
      usage: toUsage(payload?.usageMetadata),
    };
  }

  async *generateStream(
    connection: ResolvedAiConnection,
    request: AiGenerateRequest,
  ): AsyncIterable<AiStreamEvent> {
    const baseUrl = await this.requireGuardedBaseUrl(connection);
    const url = `${baseUrl}/models/${encodeURIComponent(connection.model)}:streamGenerateContent?alt=sse`;

    let response: Response;

    try {
      const authenticated = applyAiCredential(connection, url, {
        'Content-Type': 'application/json',
      });
      response = await safeExternalFetch(authenticated.url, {
        method: 'POST',
        headers: authenticated.headers,
        body: JSON.stringify(buildRequestBody(request)),
        signal: AbortSignal.timeout(AI_STREAM_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AiProtocolRequestError(
        `Không thể kết nối tới Gemini: ${(error as Error).message}`,
        null,
      );
    }

    if (!response.ok) {
      const payload = (await response
        .json()
        .catch(() => null)) as GenerateContentPayload | null;
      throw new AiProtocolRequestError(
        payload?.error?.message ?? `Gemini trả về lỗi ${response.status}`,
        response.status,
      );
    }

    for await (const eventBlock of readSseEventBlocks(response)) {
      for (const data of extractSseDataLines(eventBlock)) {
        const chunk = safeJsonParse<GenerateContentPayload>(data);
        const text = chunk?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? '')
          .join('');
        if (text) yield { type: 'TEXT_DELTA', text };

        const usage = toUsage(chunk?.usageMetadata);
        if (usage) yield { type: 'USAGE', usage };
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
      const authenticated = applyAiCredential(connection, `${baseUrl}/models`);
      response = await safeExternalFetch(authenticated.url, {
        headers: authenticated.headers,
        signal: AbortSignal.timeout(AI_PROVIDER_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AiProtocolRequestError(
        `Không thể kết nối tới Gemini: ${(error as Error).message}`,
        null,
      );
    }

    const payload = (await response
      .json()
      .catch(() => null)) as ListModelsPayload | null;

    if (!response.ok) {
      throw new AiProtocolRequestError(
        payload?.error?.message ?? `Gemini trả về lỗi ${response.status}`,
        response.status,
      );
    }

    return (payload?.models ?? []).flatMap((model) => {
      const id = model.name?.replace(/^models\//, '');
      if (!id) return [];
      return [
        {
          id,
          ...(model.displayName ? { displayName: model.displayName } : {}),
          ...(model.inputTokenLimit !== undefined
            ? { contextLength: model.inputTokenLimit }
            : {}),
          ...(model.outputTokenLimit !== undefined
            ? { maxOutputTokens: model.outputTokenLimit }
            : {}),
        },
      ];
    });
  }

  private async requireGuardedBaseUrl(
    connection: ResolvedAiConnection,
  ): Promise<string> {
    const url = await assertPublicHttpsUrl(connection.baseUrl);
    return normalizeProtocolBaseUrl(url, 'v1beta');
  }
}

import { Injectable } from '@nestjs/common';

import {
  AiConnectionConfig,
  AiConnectionTestResult,
  AiGenerateRequest,
  AiGenerateResponse,
  AiProviderClientPort,
  AiProviderRequestError,
} from '../../application/ports/ai-provider-client.port';

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_API_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 1024;

interface MessagesPayload {
  content?: { type?: string; text?: string }[];
  error?: { message?: string };
}

interface ListModelsPayload {
  data?: { id?: string }[];
  error?: { message?: string };
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
        body: JSON.stringify({
          model: config.model,
          max_tokens: request.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
          ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
          ...(request.temperature !== undefined
            ? { temperature: request.temperature }
            : {}),
          messages: request.messages
            .filter((message) => message.role !== 'system')
            .map((message) => ({
              role: message.role,
              content: message.content,
            })),
        }),
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
    };
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

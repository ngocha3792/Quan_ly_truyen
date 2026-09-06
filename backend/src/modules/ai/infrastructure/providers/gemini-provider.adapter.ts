import { Injectable } from '@nestjs/common';

import {
  AiConnectionConfig,
  AiConnectionTestResult,
  AiGenerateRequest,
  AiGenerateResponse,
  AiProviderClientPort,
  AiProviderRequestError,
} from '../../application/ports/ai-provider-client.port';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 1024;

interface GenerateContentPayload {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

interface ListModelsPayload {
  models?: { name?: string }[];
  error?: { message?: string };
}

@Injectable()
export class GeminiProviderAdapter implements AiProviderClientPort {
  async generate(
    config: AiConnectionConfig,
    request: AiGenerateRequest,
  ): Promise<AiGenerateResponse> {
    const startedAt = Date.now();
    const url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(request.systemPrompt
            ? { systemInstruction: { parts: [{ text: request.systemPrompt }] } }
            : {}),
          contents: request.messages.map((message) => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: message.content }],
          })),
          generationConfig: {
            maxOutputTokens: request.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
            ...(request.temperature !== undefined
              ? { temperature: request.temperature }
              : {}),
          },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AiProviderRequestError(
        `Không thể kết nối tới Gemini: ${(error as Error).message}`,
        null,
      );
    }

    const payload = (await response
      .json()
      .catch(() => null)) as GenerateContentPayload | null;

    if (!response.ok) {
      throw new AiProviderRequestError(
        payload?.error?.message ?? `Gemini trả về lỗi ${response.status}`,
        response.status,
      );
    }

    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('');
    if (!text) {
      throw new AiProviderRequestError(
        'Gemini không trả về nội dung phản hồi',
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
      response = await fetch(
        `${GEMINI_BASE_URL}/models?key=${encodeURIComponent(config.apiKey)}`,
        { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
      );
    } catch (error) {
      throw new AiProviderRequestError(
        `Không thể kết nối tới Gemini: ${(error as Error).message}`,
        null,
      );
    }

    const payload = (await response
      .json()
      .catch(() => null)) as ListModelsPayload | null;

    if (!response.ok) {
      throw new AiProviderRequestError(
        payload?.error?.message ?? `Gemini trả về lỗi ${response.status}`,
        response.status,
      );
    }

    return (payload?.models ?? [])
      .map((model) => model.name?.replace(/^models\//, ''))
      .filter((name): name is string => Boolean(name));
  }
}

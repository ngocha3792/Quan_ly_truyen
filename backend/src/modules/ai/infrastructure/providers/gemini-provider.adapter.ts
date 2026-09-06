import { Injectable } from '@nestjs/common';

import {
  AiChatMessage,
  AiProviderClientPort,
  AiProviderRequestError,
} from '../../application/ports/ai-provider-client.port';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 1024;

@Injectable()
export class GeminiProviderAdapter implements AiProviderClientPort {
  async sendMessage(
    apiKey: string,
    model: string,
    messages: readonly AiChatMessage[],
  ): Promise<string> {
    const url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages.map((message) => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: message.content }],
          })),
          generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AiProviderRequestError(
        `Không thể kết nối tới Gemini: ${(error as Error).message}`,
        null,
      );
    }

    const payload = (await response.json().catch(() => null)) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    } | null;

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

    return text;
  }
}

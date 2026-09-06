import { Injectable } from '@nestjs/common';

import {
  AiChatMessage,
  AiProviderClientPort,
  AiProviderRequestError,
} from '../../application/ports/ai-provider-client.port';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 1024;

@Injectable()
export class OpenAiProviderAdapter implements AiProviderClientPort {
  async sendMessage(
    apiKey: string,
    model: string,
    messages: readonly AiChatMessage[],
  ): Promise<string> {
    let response: Response;

    try {
      response = await fetch(OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          max_tokens: MAX_OUTPUT_TOKENS,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AiProviderRequestError(
        `Không thể kết nối tới OpenAI: ${(error as Error).message}`,
        null,
      );
    }

    const payload = (await response.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    } | null;

    if (!response.ok) {
      throw new AiProviderRequestError(
        payload?.error?.message ?? `OpenAI trả về lỗi ${response.status}`,
        response.status,
      );
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw new AiProviderRequestError(
        'OpenAI không trả về nội dung phản hồi',
        response.status,
      );
    }

    return content;
  }
}

import { Injectable } from '@nestjs/common';

import {
  AiChatMessage,
  AiProviderClientPort,
  AiProviderRequestError,
} from '../../application/ports/ai-provider-client.port';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 1024;

@Injectable()
export class AnthropicProviderAdapter implements AiProviderClientPort {
  async sendMessage(
    apiKey: string,
    model: string,
    messages: readonly AiChatMessage[],
  ): Promise<string> {
    let response: Response;

    try {
      response = await fetch(ANTHROPIC_ENDPOINT, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          messages: messages.map((message) => ({
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

    const payload = (await response.json().catch(() => null)) as {
      content?: { type?: string; text?: string }[];
      error?: { message?: string };
    } | null;

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

    return text;
  }
}

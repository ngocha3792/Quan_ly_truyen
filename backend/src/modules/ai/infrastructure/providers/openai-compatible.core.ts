import {
  AiConnectionConfig,
  AiConnectionTestResult,
  AiGenerateRequest,
  AiGenerateResponse,
  AiMessage,
  AiProviderRequestError,
} from '../../application/ports/ai-provider-client.port';
import {
  readBodyWithLimit,
  safeExternalFetch,
} from '../security/ssrf-guard.util';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 1024;

function buildMessages(request: AiGenerateRequest): AiMessage[] {
  const messages: AiMessage[] = [];
  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }
  messages.push(...request.messages);
  return messages;
}

interface ChatCompletionPayload {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

interface ModelListPayload {
  data?: { id?: string }[];
  error?: { message?: string };
}

/**
 * Shared OpenAI Chat Completions-shaped implementation, reused by both the
 * first-party OpenAI adapter (fixed, trusted base URL) and the
 * OpenAI-Compatible adapter (user-supplied base URL, SSRF-guarded).
 */
export async function openAiCompatibleGenerate(
  config: AiConnectionConfig,
  request: AiGenerateRequest,
  baseUrl: string,
): Promise<AiGenerateResponse> {
  const startedAt = Date.now();
  let response: Response;

  try {
    response = await safeExternalFetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: buildMessages(request),
        temperature: request.temperature,
        max_tokens: request.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new AiProviderRequestError(
      `Không thể kết nối tới máy chủ AI: ${(error as Error).message}`,
      null,
    );
  }

  const body = await readBodyWithLimit(response);
  const payload = safeJsonParse<ChatCompletionPayload>(body);

  if (!response.ok) {
    throw new AiProviderRequestError(
      payload?.error?.message ?? `Máy chủ AI trả về lỗi ${response.status}`,
      response.status,
    );
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiProviderRequestError(
      'Máy chủ AI không trả về nội dung phản hồi',
      response.status,
    );
  }

  return {
    content,
    provider: config.provider,
    model: config.model,
    latencyMs: Date.now() - startedAt,
  };
}

export async function openAiCompatibleListModels(
  config: AiConnectionConfig,
  baseUrl: string,
): Promise<readonly string[]> {
  let response: Response;

  try {
    response = await safeExternalFetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new AiProviderRequestError(
      `Không thể kết nối tới máy chủ AI: ${(error as Error).message}`,
      null,
    );
  }

  const body = await readBodyWithLimit(response);
  const payload = safeJsonParse<ModelListPayload>(body);

  if (!response.ok) {
    throw new AiProviderRequestError(
      payload?.error?.message ?? `Máy chủ AI trả về lỗi ${response.status}`,
      response.status,
    );
  }

  return (payload?.data ?? [])
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id));
}

export async function openAiCompatibleTestConnection(
  config: AiConnectionConfig,
  baseUrl: string,
): Promise<AiConnectionTestResult> {
  try {
    await openAiCompatibleListModels(config, baseUrl);
    return { ok: true };
  } catch (error) {
    if (error instanceof AiProviderRequestError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: (error as Error).message };
  }
}

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

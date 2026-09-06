import { AiMessage, AiSendMessageStreamEvent, AiUsage } from '../domain/ai-assistant.models';

type WireEvent = Record<string, unknown>;

export function parseAiStreamEvent(json: string): AiSendMessageStreamEvent | null {
  let payload: WireEvent;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!isRecord(parsed)) return null;
    payload = parsed;
  } catch {
    return null;
  }

  const type = normalizedType(payload);
  if (type === 'TEXT_DELTA' && typeof payload['text'] === 'string') {
    return { type, text: payload['text'] };
  }
  if (type === 'USAGE' && isUsage(payload['usage'])) {
    return { type, usage: payload['usage'] };
  }
  if (
    type === 'DONE' &&
    isMessage(payload['userMessage']) &&
    isMessage(payload['assistantMessage'])
  ) {
    return {
      type,
      userMessage: payload['userMessage'],
      assistantMessage: payload['assistantMessage'],
    };
  }
  if (type === 'ERROR' && typeof payload['message'] === 'string') {
    return { type, message: payload['message'] };
  }
  return null;
}

function normalizedType(payload: WireEvent): AiSendMessageStreamEvent['type'] | null {
  const event = payload['event'];
  if (event === 'TEXT_DELTA' || event === 'USAGE' || event === 'DONE' || event === 'ERROR') {
    return event;
  }

  switch (payload['type']) {
    case 'delta':
      return 'TEXT_DELTA';
    case 'done':
      return 'DONE';
    case 'error':
      return 'ERROR';
    default:
      return null;
  }
}

function isUsage(value: unknown): value is AiUsage {
  if (!isRecord(value)) return false;
  return (
    isOptionalNonNegativeNumber(value['inputTokens']) &&
    isOptionalNonNegativeNumber(value['outputTokens'])
  );
}

function isMessage(value: unknown): value is AiMessage {
  if (!isRecord(value)) return false;
  return (
    typeof value['id'] === 'string' &&
    (value['role'] === 'USER' || value['role'] === 'ASSISTANT') &&
    typeof value['content'] === 'string' &&
    typeof value['createdAt'] === 'string'
  );
}

function isOptionalNonNegativeNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && value >= 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

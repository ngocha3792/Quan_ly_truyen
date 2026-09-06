import { AiProtocolRequestError } from '../../application/ports/ai-protocol-adapter.port';
import { AiErrorCode } from '../../domain/enums';

const MAX_STREAM_BYTES = 2 * 1024 * 1024;

/**
 * Reads a fetch Response body as a stream of raw SSE event blocks (the text
 * between "\n\n" separators). Each adapter parses the "data:"/"event:" lines
 * within a block according to its own provider's format.
 */
export async function* readSseEventBlocks(
  response: Response,
): AsyncIterable<string> {
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let received = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      received += value.byteLength;
      if (received > MAX_STREAM_BYTES) {
        await reader.cancel();
        throw new AiProtocolRequestError(
          'Phản hồi từ máy chủ AI vượt quá giới hạn cho phép.',
          null,
        );
      }

      buffer += decoder.decode(value, { stream: true });
      buffer = normalizeLineEndings(buffer);

      let separatorIndex = buffer.indexOf('\n\n');
      while (separatorIndex !== -1) {
        yield buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        separatorIndex = buffer.indexOf('\n\n');
      }
    }

    buffer += decoder.decode();
    buffer = normalizeLineEndings(buffer);
    if (buffer.trim()) {
      yield buffer;
    }
  } catch (error) {
    if (error instanceof AiProtocolRequestError) throw error;
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError')
    ) {
      throw new AiProtocolRequestError(
        'AI stream đã vượt quá thời gian chờ 10 phút.',
        null,
        AiErrorCode.TIMEOUT,
      );
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}

function normalizeLineEndings(value: string): string {
  return value.replaceAll('\r\n', '\n');
}

export function extractSseDataLines(eventBlock: string): readonly string[] {
  return eventBlock
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());
}

export function extractSseEventName(eventBlock: string): string | null {
  const line = eventBlock
    .split('\n')
    .find((entry) => entry.startsWith('event:'));
  return line ? line.slice(6).trim() : null;
}

export function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

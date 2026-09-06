import { describe, expect, it } from 'vitest';

import { parseAiStreamEvent } from './ai-stream-event.parser';

describe('parseAiStreamEvent', () => {
  it('normalize contract Sprint 6 và usage token', () => {
    expect(
      parseAiStreamEvent(
        JSON.stringify({
          type: 'delta',
          event: 'USAGE',
          text: '',
          usage: { inputTokens: 10_000, outputTokens: 10_000 },
        }),
      ),
    ).toEqual({
      type: 'USAGE',
      usage: { inputTokens: 10_000, outputTokens: 10_000 },
    });
  });

  it('vẫn đọc wire event cũ khi rolling deploy', () => {
    expect(parseAiStreamEvent('{"type":"delta","text":"hello"}')).toEqual({
      type: 'TEXT_DELTA',
      text: 'hello',
    });
  });

  it('bỏ qua payload không hợp lệ', () => {
    expect(parseAiStreamEvent('{"event":"USAGE","usage":{"inputTokens":-1}}')).toBeNull();
    expect(parseAiStreamEvent('invalid-json')).toBeNull();
  });
});

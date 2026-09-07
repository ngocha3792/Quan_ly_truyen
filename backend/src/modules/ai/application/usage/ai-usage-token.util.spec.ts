import { normalizeAiUsageToken } from './ai-usage-token.util';

describe('normalizeAiUsageToken', () => {
  it.each([0, 1, 10_000, 2_147_483_647])('giữ token hợp lệ: %s', (value) => {
    expect(normalizeAiUsageToken(value)).toBe(value);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])(
    'bỏ token provider không hợp lệ: %s',
    (value) => {
      expect(normalizeAiUsageToken(value)).toBeUndefined();
    },
  );
});

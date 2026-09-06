import { fitMessagesToInputTokenBudget } from './ai-input-token-budget';

describe('fitMessagesToInputTokenBudget', () => {
  it('giữ message mới nhất và bỏ lịch sử cũ vượt ngân sách input', () => {
    const messages = [
      { role: 'user' as const, content: 'a'.repeat(24) },
      { role: 'assistant' as const, content: 'b'.repeat(24) },
      { role: 'user' as const, content: 'latest' },
    ];

    expect(fitMessagesToInputTokenBudget('system', messages, 10)).toEqual([
      messages[1],
      messages[2],
    ]);
  });

  it('dùng mặc định ngân sách 10.000 input token', () => {
    const newest = { role: 'user' as const, content: 'x'.repeat(39_000) };

    expect(fitMessagesToInputTokenBudget('', [newest])).toEqual([newest]);
  });
});

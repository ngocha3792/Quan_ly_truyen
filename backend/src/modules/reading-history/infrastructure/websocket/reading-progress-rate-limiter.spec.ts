import { ReadingProgressRateLimiter } from './reading-progress-rate-limiter';

describe('ReadingProgressRateLimiter', () => {
  it('uses an atomic Redis NX lease shared by every API instance', async () => {
    const redis = {
      set: jest.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null),
    };
    const limiter = new ReadingProgressRateLimiter(redis as never);

    await expect(limiter.accept('user-1')).resolves.toBe(true);
    await expect(limiter.accept('user-1')).resolves.toBe(false);
    expect(redis.set).toHaveBeenCalledWith(
      'reading-progress:rate-limit:user-1',
      '1',
      'PX',
      2_000,
      'NX',
    );
  });

  it('fails closed when Redis is unavailable', async () => {
    await expect(
      new ReadingProgressRateLimiter(null).accept('user-1'),
    ).resolves.toBe(false);
    await expect(
      new ReadingProgressRateLimiter({
        set: jest.fn().mockRejectedValue(new Error('down')),
      } as never).accept('user-1'),
    ).resolves.toBe(false);
  });
});

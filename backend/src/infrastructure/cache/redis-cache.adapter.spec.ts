import { ConfigService } from '@nestjs/config';

import { RedisCacheAdapter } from './redis-cache.adapter';

describe('RedisCacheAdapter', () => {
  let adapter: RedisCacheAdapter;
  let mockRedisClient: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };
  const metrics = {
    recordCache: jest.fn(),
    recordRedisError: jest.fn(),
  };

  beforeEach(() => {
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue({ cacheDefaultTtlSeconds: 300 }),
    } as unknown as ConfigService;

    adapter = new RedisCacheAdapter(
      mockRedisClient as never,
      mockConfigService,
      metrics as never,
    );
  });

  it('returns null if redisClient is null', async () => {
    const noRedisAdapter = new RedisCacheAdapter(
      null,
      {
        get: () => ({ cacheDefaultTtlSeconds: 300 }),
      } as unknown as ConfigService,
      metrics as never,
    );

    expect(await noRedisAdapter.get('key')).toBeNull();
  });

  it('serializes and deserializes values with BigInt and Decimal correctly', async () => {
    const testData = {
      id: '123',
      bigVal: BigInt('9007199254740991'),
      decVal: { isDecimal: true, toString: () => '99.99' },
    };

    let storedString = '';
    mockRedisClient.set.mockImplementation((_k: string, val: string) => {
      storedString = val;
      return Promise.resolve('OK');
    });

    mockRedisClient.get.mockImplementation(() => Promise.resolve(storedString));

    await adapter.set('test:key', testData, 60);
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'test:key',
      expect.any(String),
      'EX',
      60,
    );

    const retrieved = await adapter.get<typeof testData>('test:key');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('123');
    expect(retrieved?.bigVal).toEqual(BigInt('9007199254740991'));
    expect(retrieved?.decVal).toBe('99.99');
  });

  it('handles delete and deleteMany', async () => {
    mockRedisClient.del.mockResolvedValue(1);

    await adapter.delete('key1');
    expect(mockRedisClient.del).toHaveBeenCalledWith('key1');

    await adapter.deleteMany(['key1', 'key2']);
    expect(mockRedisClient.del).toHaveBeenCalledWith('key1', 'key2');
  });

  it('catches redis errors gracefully without throwing', async () => {
    mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));

    const result = await adapter.get('failed:key');
    expect(result).toBeNull();
  });
});

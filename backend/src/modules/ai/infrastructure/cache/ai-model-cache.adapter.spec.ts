import { AiModelCacheAdapter } from './ai-model-cache.adapter';

describe('AiModelCacheAdapter', () => {
  const cache = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  };
  const adapter = new AiModelCacheAdapter(cache as never);

  it('namespace cache key theo connection', async () => {
    cache.get.mockResolvedValue([{ id: 'model-1' }]);

    await expect(adapter.get('connection-1')).resolves.toEqual([
      { id: 'model-1' },
    ]);
    expect(cache.get).toHaveBeenCalledWith('ai:models:connection-1');

    await adapter.set('connection-1', [{ id: 'model-2' }], 600);
    expect(cache.set).toHaveBeenCalledWith(
      'ai:models:connection-1',
      [{ id: 'model-2' }],
      600,
    );

    await adapter.delete('connection-1');
    expect(cache.delete).toHaveBeenCalledWith('ai:models:connection-1');
  });
});

import { AiAuthType, AiProtocol } from '../../../domain/enums';
import { AiProtocolRequestError, type AiConnectionRecord } from '../../ports';
import { ListAiConnectionModelsQueryHandler } from './list-ai-connection-models.query-handler';
import { ListAiConnectionModelsQuery } from './list-ai-connection-models.query';

const CONNECTION: AiConnectionRecord = {
  id: 'connection-1',
  userId: 'user-1',
  name: 'My gateway',
  vendorHint: 'GWAI',
  protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
  authType: AiAuthType.BEARER,
  authHeaderName: null,
  encryptedCredential: 'encrypted',
  baseUrl: 'https://gateway.example.com/v1',
  defaultModel: 'model-default',
  enabled: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const RESOLVED = {
  protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
  vendorHint: 'GWAI',
  baseUrl: 'https://gateway.example.com/v1',
  authType: AiAuthType.BEARER,
  authHeaderName: null,
  credential: 'plain',
  model: 'model-default',
};

describe('ListAiConnectionModelsQueryHandler', () => {
  const persistence = { findByOwnerAndId: jest.fn() };
  const resolvedConnections = { fromRecord: jest.fn() };
  const adapter = { listModels: jest.fn() };
  const protocols = { getAdapter: jest.fn().mockReturnValue(adapter) };
  const cache = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  };
  const handler = new ListAiConnectionModelsQueryHandler(
    persistence as never,
    resolvedConnections as never,
    protocols as never,
    cache,
  );

  beforeEach(() => {
    persistence.findByOwnerAndId.mockResolvedValue(CONNECTION);
    resolvedConnections.fromRecord.mockResolvedValue(RESOLVED);
    cache.get.mockResolvedValue(null);
    adapter.listModels.mockResolvedValue([
      { id: 'model-1', displayName: 'Model One' },
    ]);
  });

  it('trả model từ cache mà không gọi provider', async () => {
    cache.get.mockResolvedValue([{ id: 'cached-model' }]);

    await expect(
      handler.execute(new ListAiConnectionModelsQuery('user-1', CONNECTION.id)),
    ).resolves.toEqual([{ id: 'cached-model' }]);

    expect(cache.get).toHaveBeenCalledWith('connection-1');
    expect(adapter.listModels).not.toHaveBeenCalled();
  });

  it('cache model discovery trong 10 phút khi cache miss', async () => {
    const models = await handler.execute(
      new ListAiConnectionModelsQuery('user-1', CONNECTION.id),
    );

    expect(models).toEqual([{ id: 'model-1', displayName: 'Model One' }]);
    expect(adapter.listModels).toHaveBeenCalledWith(RESOLVED);
    expect(cache.set).toHaveBeenCalledWith('connection-1', models, 600);
  });

  it('xóa cache và gọi lại provider khi refresh', async () => {
    await handler.execute(
      new ListAiConnectionModelsQuery('user-1', CONNECTION.id, true),
    );

    expect(cache.delete).toHaveBeenCalledWith('connection-1');
    expect(cache.get).not.toHaveBeenCalled();
    expect(adapter.listModels).toHaveBeenCalledWith(RESOLVED);
  });

  it('trả danh sách rỗng khi protocol không hỗ trợ model discovery', async () => {
    adapter.listModels.mockRejectedValue(
      new AiProtocolRequestError('Not implemented', 501),
    );

    await expect(
      handler.execute(new ListAiConnectionModelsQuery('user-1', CONNECTION.id)),
    ).resolves.toEqual([]);
    expect(cache.set).toHaveBeenCalledWith('connection-1', [], 600);
  });
});

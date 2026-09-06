import { AiFallbackPolicy, AiProvider } from '../../domain/enums';
import { AiConnectionResolver } from './ai-connection-resolver';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function connection(id: string, userId: string | null) {
  return {
    id,
    userId,
    name: id,
    provider: AiProvider.OPENAI,
    encryptedApiKey: 'encrypted',
    baseUrl: null,
    defaultModel: 'gpt-4o-mini',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('AiConnectionResolver fallback policy', () => {
  const personal = connection('personal', USER_ID);
  const system = connection('system', null);
  let connections: {
    findById: jest.Mock;
    findFirstEnabledByOwnerAndProvider: jest.Mock;
  };
  let policies: { findByUserId: jest.Mock };

  beforeEach(() => {
    connections = {
      findById: jest.fn().mockResolvedValue(personal),
      findFirstEnabledByOwnerAndProvider: jest.fn((owner) =>
        owner === null ? system : personal,
      ),
    };
    policies = { findByUserId: jest.fn() };
  });

  it('mặc định NONE và không hề đọc system connection', async () => {
    policies.findByUserId.mockResolvedValue(null);
    const resolver = new AiConnectionResolver(
      connections as never,
      policies as never,
    );

    const plan = await resolver.resolvePlan({
      userId: USER_ID,
      connectionId: personal.id,
    });

    expect(plan).toEqual(
      expect.objectContaining({
        primary: personal,
        systemFallback: null,
        fallbackPolicy: AiFallbackPolicy.NONE,
      }),
    );
    expect(
      connections.findFirstEnabledByOwnerAndProvider,
    ).not.toHaveBeenCalled();
  });

  it('NONE không tự chọn system key khi user không có connection', async () => {
    policies.findByUserId.mockResolvedValue({
      fallbackPolicy: AiFallbackPolicy.NONE,
    });
    connections.findById.mockResolvedValue(null);
    connections.findFirstEnabledByOwnerAndProvider.mockResolvedValue(null);
    const resolver = new AiConnectionResolver(
      connections as never,
      policies as never,
    );

    await expect(
      resolver.resolvePlan({ userId: USER_ID, provider: AiProvider.OPENAI }),
    ).resolves.toBeNull();
    expect(
      connections.findFirstEnabledByOwnerAndProvider,
    ).not.toHaveBeenCalledWith(null, AiProvider.OPENAI);
  });

  it('SYSTEM tạo fallback plan rõ ràng cho personal connection', async () => {
    policies.findByUserId.mockResolvedValue({
      fallbackPolicy: AiFallbackPolicy.SYSTEM,
    });
    const resolver = new AiConnectionResolver(
      connections as never,
      policies as never,
    );

    const plan = await resolver.resolvePlan({
      userId: USER_ID,
      connectionId: personal.id,
    });

    expect(plan?.primary).toBe(personal);
    expect(plan?.systemFallback).toBe(system);
    expect(connections.findFirstEnabledByOwnerAndProvider).toHaveBeenCalledWith(
      null,
      AiProvider.OPENAI,
    );
  });
});

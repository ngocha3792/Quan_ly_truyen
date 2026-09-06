import { AiAuthType, AiFallbackPolicy, AiProtocol } from '../../domain/enums';
import { AiConnectionResolver } from './ai-connection-resolver';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function connection(id: string, userId: string | null) {
  return {
    id,
    userId,
    name: id,
    vendorHint: 'openai',
    protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
    authType: AiAuthType.BEARER,
    authHeaderName: null,
    encryptedCredential: 'encrypted',
    baseUrl: 'https://api.openai.com/v1',
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
    findFirstEnabledByOwnerAndProtocol: jest.Mock;
  };
  let policies: { findByUserId: jest.Mock };

  beforeEach(() => {
    connections = {
      findById: jest.fn().mockResolvedValue(personal),
      findFirstEnabledByOwnerAndProtocol: jest.fn((owner) =>
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
      connections.findFirstEnabledByOwnerAndProtocol,
    ).not.toHaveBeenCalled();
  });

  it('NONE không tự chọn system key khi user không có connection', async () => {
    policies.findByUserId.mockResolvedValue({
      fallbackPolicy: AiFallbackPolicy.NONE,
    });
    connections.findById.mockResolvedValue(null);
    connections.findFirstEnabledByOwnerAndProtocol.mockResolvedValue(null);
    const resolver = new AiConnectionResolver(
      connections as never,
      policies as never,
    );

    await expect(
      resolver.resolvePlan({
        userId: USER_ID,
        protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
      }),
    ).resolves.toBeNull();
    expect(
      connections.findFirstEnabledByOwnerAndProtocol,
    ).not.toHaveBeenCalledWith(null, AiProtocol.OPENAI_CHAT_COMPLETIONS);
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
    expect(connections.findFirstEnabledByOwnerAndProtocol).toHaveBeenCalledWith(
      null,
      AiProtocol.OPENAI_CHAT_COMPLETIONS,
    );
  });
});

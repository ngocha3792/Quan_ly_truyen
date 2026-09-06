import { AiAuthType, AiProtocol } from '../../domain/enums';
import type { AiConnectionRecord } from '../ports';
import { AiResolvedConnectionFactory } from './ai-resolved-connection.factory';

const CONNECTION: AiConnectionRecord = {
  id: 'connection-id',
  userId: 'user-id',
  name: 'Proxy',
  vendorHint: 'CUSTOM_SHOP',
  protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
  authType: AiAuthType.BEARER,
  authHeaderName: null,
  encryptedCredential: 'encrypted-secret',
  baseUrl: 'https://ai.example.com/v1',
  defaultModel: 'connection-model',
  enabled: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe('AiResolvedConnectionFactory', () => {
  const vault = { decrypt: jest.fn().mockResolvedValue('plain-secret') };
  const protocols = { getDefaultModel: jest.fn().mockReturnValue('default') };
  const factory = new AiResolvedConnectionFactory(
    vault as never,
    protocols as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('giải mã credential và giữ metadata routing generic', async () => {
    await expect(factory.fromRecord(CONNECTION)).resolves.toEqual({
      protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
      vendorHint: 'CUSTOM_SHOP',
      baseUrl: 'https://ai.example.com/v1',
      authType: AiAuthType.BEARER,
      authHeaderName: null,
      credential: 'plain-secret',
      model: 'connection-model',
    });
    expect(vault.decrypt).toHaveBeenCalledWith('encrypted-secret');
  });

  it('ưu tiên model override và fallback về protocol default', async () => {
    await expect(
      factory.fromRecord(CONNECTION, 'override'),
    ).resolves.toMatchObject({ model: 'override' });
    await expect(
      factory.fromRecord({ ...CONNECTION, defaultModel: null }),
    ).resolves.toMatchObject({ model: 'default' });
  });
});

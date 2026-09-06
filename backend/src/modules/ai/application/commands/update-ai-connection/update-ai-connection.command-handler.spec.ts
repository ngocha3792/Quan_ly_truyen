import { AiAuthType, AiProtocol } from '../../../domain/enums';
import type { AiConnectionPersistencePort } from '../../ports';
import { UpdateAiConnectionCommand } from './update-ai-connection.command';
import { UpdateAiConnectionCommandHandler } from './update-ai-connection.command-handler';

const EXISTING = {
  id: 'connection-id',
  userId: 'user-id',
  name: 'GWAI',
  vendorHint: 'ANTHROPIC_COMPATIBLE',
  protocol: AiProtocol.ANTHROPIC_MESSAGES,
  authType: AiAuthType.X_API_KEY,
  authHeaderName: 'x-api-key',
  encryptedCredential: 'encrypted',
  baseUrl: 'https://1gw.gwai.cloud',
  defaultModel: 'claude-sonnet-5',
  enabled: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe('UpdateAiConnectionCommandHandler compatible auth', () => {
  let persistence: jest.Mocked<AiConnectionPersistencePort>;
  let vault: { decrypt: jest.Mock; encrypt: jest.Mock };
  let adapter: { testConnection: jest.Mock };
  let updateMock: jest.Mock;
  let handler: UpdateAiConnectionCommandHandler;

  beforeEach(() => {
    updateMock = jest.fn().mockResolvedValue(EXISTING);
    persistence = {
      listByOwner: jest.fn(),
      findById: jest.fn(),
      findByOwnerAndId: jest.fn().mockResolvedValue(EXISTING),
      findFirstEnabledByOwnerAndProtocol: jest.fn(),
      findFirstEnabledByOwner: jest.fn(),
      create: jest.fn(),
      update: updateMock,
      delete: jest.fn(),
    };
    vault = {
      decrypt: jest.fn().mockResolvedValue('plain-secret'),
      encrypt: jest.fn(),
    };
    adapter = { testConnection: jest.fn().mockResolvedValue({ ok: true }) };
    handler = new UpdateAiConnectionCommandHandler(persistence, vault, {
      getAdapter: jest.fn().mockReturnValue(adapter),
      getDefaultModel: jest.fn().mockReturnValue('protocol-default'),
    });
  });

  it('test rồi persist khi đổi sang custom header auth', async () => {
    await handler.execute(
      new UpdateAiConnectionCommand('user-id', 'connection-id', {
        authType: AiAuthType.API_KEY_HEADER,
        authHeaderName: 'X-GWAI-Key',
      }),
    );

    expect(adapter.testConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        protocol: AiProtocol.ANTHROPIC_MESSAGES,
        authType: AiAuthType.API_KEY_HEADER,
        authHeaderName: 'X-GWAI-Key',
        credential: 'plain-secret',
      }),
    );
    expect(updateMock).toHaveBeenCalledWith(
      'connection-id',
      expect.objectContaining({
        authType: AiAuthType.API_KEY_HEADER,
        authHeaderName: 'X-GWAI-Key',
      }),
    );
  });

  it('đổi về Bearer sẽ xóa auth header cũ', async () => {
    await handler.execute(
      new UpdateAiConnectionCommand('user-id', 'connection-id', {
        authType: AiAuthType.BEARER,
      }),
    );

    expect(updateMock).toHaveBeenCalledWith(
      'connection-id',
      expect.objectContaining({
        authType: AiAuthType.BEARER,
        authHeaderName: null,
      }),
    );
  });

  it('test bằng adapter mới rồi đồng bộ protocol khi đổi custom gateway', async () => {
    persistence.findByOwnerAndId.mockResolvedValue({
      ...EXISTING,
      vendorHint: 'CUSTOM',
    });
    const registry = {
      getAdapter: jest.fn().mockReturnValue(adapter),
      getDefaultModel: jest.fn().mockReturnValue('protocol-default'),
    };
    handler = new UpdateAiConnectionCommandHandler(
      persistence,
      vault,
      registry,
    );

    await handler.execute(
      new UpdateAiConnectionCommand('user-id', 'connection-id', {
        protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
      }),
    );

    expect(registry.getAdapter).toHaveBeenCalledWith(
      AiProtocol.OPENAI_CHAT_COMPLETIONS,
    );
    expect(adapter.testConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
        credential: 'plain-secret',
      }),
    );
    expect(updateMock).toHaveBeenCalledWith(
      'connection-id',
      expect.objectContaining({
        protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
        vendorHint: 'CUSTOM',
      }),
    );
  });
});

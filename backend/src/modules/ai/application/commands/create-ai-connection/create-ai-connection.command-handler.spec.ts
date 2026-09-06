import { AiAuthType, AiProtocol } from '../../../domain/enums';
import { CreateAiConnectionCommand } from './create-ai-connection.command';
import { CreateAiConnectionCommandHandler } from './create-ai-connection.command-handler';

describe('CreateAiConnectionCommandHandler security', () => {
  const created = {
    id: '22222222-2222-4222-8222-222222222222',
    userId: '11111111-1111-4111-8111-111111111111',
    name: 'Gateway',
    vendorHint: 'CUSTOM',
    protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
    authType: AiAuthType.BEARER,
    authHeaderName: null,
    encryptedCredential: 'encrypted-envelope',
    baseUrl: 'https://ai.example.com/v1',
    defaultModel: 'model-1',
    enabled: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };

  it('rate limit outbound validation, chỉ persist ciphertext và ghi audit', async () => {
    const persistence = { create: jest.fn().mockResolvedValue(created) };
    const vault = {
      encrypt: jest.fn().mockResolvedValue('encrypted-envelope'),
    };
    const adapter = {
      testConnection: jest.fn().mockResolvedValue({ ok: true }),
    };
    const rateLimits = {
      reserveExternalRequests: jest.fn().mockResolvedValue(undefined),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const handler = new CreateAiConnectionCommandHandler(
      persistence as never,
      vault as never,
      {
        getAdapter: jest.fn().mockReturnValue(adapter),
        getDefaultModel: jest.fn().mockReturnValue('fallback-model'),
      },
      rateLimits as never,
      audit,
    );

    await handler.execute(
      new CreateAiConnectionCommand(
        created.userId,
        created.name,
        created.vendorHint,
        created.protocol,
        created.authType,
        null,
        'plain-secret',
        created.baseUrl,
        created.defaultModel,
      ),
    );

    expect(rateLimits.reserveExternalRequests).toHaveBeenCalledWith(
      created.userId,
      1,
    );
    expect(persistence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        encryptedCredential: 'encrypted-envelope',
      }),
    );
    expect(JSON.stringify(persistence.create.mock.calls)).not.toContain(
      'plain-secret',
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ai.connection.created',
        connectionId: created.id,
        outcome: 'SUCCESS',
      }),
    );
  });
});

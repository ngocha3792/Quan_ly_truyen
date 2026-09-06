import { AiAuthType, AiProtocol } from '../../../domain/enums';
import { ProbeAiConnectionCapabilitiesCommand } from './probe-ai-connection-capabilities.command';
import { ProbeAiConnectionCapabilitiesCommandHandler } from './probe-ai-connection-capabilities.command-handler';

const CONNECTION_ID = '11111111-1111-4111-8111-111111111111';

describe('ProbeAiConnectionCapabilitiesCommandHandler', () => {
  it('probe chủ động và lưu capability theo connection + model', async () => {
    const connection = {
      id: CONNECTION_ID,
      protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
      updatedAt: new Date(0),
    };
    const resolved = {
      protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
      vendorHint: 'CUSTOM',
      baseUrl: 'https://gateway.example.com/v1',
      authType: AiAuthType.BEARER,
      authHeaderName: null,
      credential: 'secret',
      model: 'reasoning-model',
      capabilities: null,
    };
    const persistence = {
      findByOwnerAndId: jest.fn().mockResolvedValue(connection),
      update: jest
        .fn()
        .mockImplementation((_id: string, input: Record<string, unknown>) =>
          Promise.resolve({ ...connection, ...input }),
        ),
    };
    const adapter = {
      listModels: jest.fn().mockResolvedValue([
        {
          id: 'reasoning-model',
          reasoning: true,
          vision: true,
          tools: false,
        },
      ]),
      generate: jest
        .fn()
        .mockResolvedValueOnce({ content: 'OK' })
        .mockResolvedValueOnce({ content: 'CAPABILITY_OK' }),
      generateStream: jest.fn().mockImplementation(async function* () {
        await Promise.resolve();
        yield { type: 'TEXT_DELTA', text: 'OK' } as const;
        yield { type: 'DONE' } as const;
      }),
    };
    const handler = new ProbeAiConnectionCapabilitiesCommandHandler(
      persistence as never,
      { fromRecord: jest.fn().mockResolvedValue(resolved) } as never,
      { getAdapter: jest.fn().mockReturnValue(adapter) } as never,
    );

    const result = await handler.execute(
      new ProbeAiConnectionCapabilitiesCommand('user-id', CONNECTION_ID),
    );

    expect(result).toMatchObject({
      connectionId: CONNECTION_ID,
      model: 'reasoning-model',
      capabilities: {
        chat: true,
        modelDiscovery: true,
        streaming: true,
        systemPrompt: true,
        tools: false,
        vision: true,
        reasoning: true,
      },
      failedChecks: [],
    });
    expect(persistence.update).toHaveBeenCalledWith(
      CONNECTION_ID,
      expect.objectContaining({
        expectedUpdatedAt: connection.updatedAt,
        capabilityModel: 'reasoning-model',
        capabilities: result.capabilities,
        capabilitiesProbedAt: result.probedAt,
      }),
    );
  });

  it('từ chối ghi kết quả probe khi connection bị sửa giữa chừng', async () => {
    const initialUpdatedAt = new Date(0);
    const connection = {
      id: CONNECTION_ID,
      protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
      updatedAt: initialUpdatedAt,
    };
    const persistence = {
      findByOwnerAndId: jest
        .fn()
        .mockResolvedValueOnce(connection)
        .mockResolvedValueOnce({
          ...connection,
          updatedAt: new Date(initialUpdatedAt.getTime() + 1),
        }),
      update: jest.fn().mockRejectedValue(new Error('optimistic conflict')),
    };
    const adapter = {
      listModels: jest.fn().mockResolvedValue([]),
      generate: jest.fn().mockResolvedValue({ content: 'CAPABILITY_OK' }),
      generateStream: jest.fn().mockImplementation(async function* () {
        await Promise.resolve();
        yield { type: 'TEXT_DELTA', text: 'OK' } as const;
        yield { type: 'DONE' } as const;
      }),
    };
    const handler = new ProbeAiConnectionCapabilitiesCommandHandler(
      persistence as never,
      {
        fromRecord: jest.fn().mockResolvedValue({
          protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
          vendorHint: 'CUSTOM',
          baseUrl: 'https://gateway.example.com/v1',
          authType: AiAuthType.BEARER,
          authHeaderName: null,
          credential: 'secret',
          model: 'model-1',
          capabilities: null,
        }),
      } as never,
      { getAdapter: jest.fn().mockReturnValue(adapter) } as never,
    );

    await expect(
      handler.execute(
        new ProbeAiConnectionCapabilitiesCommand('user-id', CONNECTION_ID),
      ),
    ).rejects.toMatchObject({
      details: { rule: 'ai-connection.capability-probe-stale' },
    });
  });
});

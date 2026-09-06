import { AiAuthType, AiProtocol } from '../../domain/enums';
import { PrismaAiSecurityAuditAdapter } from './prisma-ai-security-audit.adapter';

describe('PrismaAiSecurityAuditAdapter', () => {
  it('chỉ ghi metadata allowlisted, không nhận credential hoặc prompt', async () => {
    const create = jest.fn((input: unknown) => {
      void input;
      return Promise.resolve({ id: 'audit-id' });
    });
    const adapter = new PrismaAiSecurityAuditAdapter(
      { auditLog: { create } } as never,
      {
        get: jest.fn().mockReturnValue({
          requestId: 'request-id',
          correlationId: 'correlation-id',
          ipAddress: '203.0.113.9',
          userAgent: 'test-agent',
        }),
      } as never,
    );

    await adapter.record({
      actorUserId: '11111111-1111-4111-8111-111111111111',
      ownerUserId: '11111111-1111-4111-8111-111111111111',
      action: 'ai.connection.updated',
      connectionId: '22222222-2222-4222-8222-222222222222',
      outcome: 'SUCCESS',
      metadata: {
        protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
        authType: AiAuthType.BEARER,
        changedFields: ['apiKey', 'baseUrl'],
      },
    });

    const firstCall: unknown = create.mock.calls[0]?.[0];
    const serialized = JSON.stringify(firstCall);
    expect(serialized).not.toContain('provider-secret');
    expect(serialized).not.toContain('systemPrompt');
    expect(firstCall).toMatchObject({
      data: {
        action: 'ai.connection.updated',
        entityType: 'AiConnection',
        requestId: 'request-id',
        metadata: {
          actorType: 'USER',
          outcome: 'SUCCESS',
          changedFields: ['apiKey', 'baseUrl'],
        },
      },
    });
  });

  it('audit best effort không làm hỏng business operation', async () => {
    const adapter = new PrismaAiSecurityAuditAdapter(
      {
        auditLog: { create: jest.fn().mockRejectedValue(new Error('db down')) },
      } as never,
      { get: jest.fn() } as never,
    );

    await expect(
      adapter.record({
        actorUserId: null,
        ownerUserId: null,
        action: 'ai.connection.deleted',
        outcome: 'SUCCESS',
      }),
    ).resolves.toBeUndefined();
  });
});

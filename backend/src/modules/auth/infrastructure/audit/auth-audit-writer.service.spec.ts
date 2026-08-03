import { AuthAuditWriterService } from './auth-audit-writer.service';

describe('AuthAuditWriterService', () => {
  it('redacts sensitive fields before persistence', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'audit-1',
    });

    const writer = new AuthAuditWriterService(
      {
        auditLog: {
          create,
        },
      } as never,

      {
        get: jest.fn().mockReturnValue({
          requestId: 'request-1',

          correlationId: 'correlation-1',

          ipAddress: '127.0.0.1',

          userAgent: 'Jest',
        }),
      } as never,
    );

    const tx = {
      auditLog: {
        create,
      },
    };

    await writer.write(
      tx as never,

      {
        actorId: '11111111-1111-4111-8111-111111111111',

        actorSessionId: '22222222-2222-4222-8222-222222222222',

        action: 'auth.password.changed',

        entityType: 'user',

        entityId: '11111111-1111-4111-8111-111111111111',

        metadata: {
          safeValue: 'visible',

          password: 'StrongPass123!',

          refreshToken: 'raw-refresh-token',

          nested: {
            authorization: 'Bearer raw-jwt',

            cookie: 'refresh_token=secret',
          },
        },
      },
    );

    const data = create.mock.calls[0][0].data;

    expect(data.metadata).toMatchObject({
      actorType: 'USER',

      actorSessionId: '22222222-2222-4222-8222-222222222222',

      correlationId: 'correlation-1',

      safeValue: 'visible',

      password: '[REDACTED]',

      refreshToken: '[REDACTED]',

      nested: {
        authorization: '[REDACTED]',

        cookie: '[REDACTED]',
      },
    });

    const serialized = JSON.stringify(data);

    expect(serialized).not.toContain('StrongPass123!');

    expect(serialized).not.toContain('raw-refresh-token');

    expect(serialized).not.toContain('raw-jwt');
  });
});

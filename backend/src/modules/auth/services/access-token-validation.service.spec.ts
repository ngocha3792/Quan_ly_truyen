import { JwtTokenType, PermissionCode, RoleCode } from '@/common/enums';
import type { AccessTokenPayload } from '@/common/interfaces/auth';
import { AccessTokenValidationService } from './access-token-validation.service';

describe('AccessTokenValidationService', () => {
  const prisma = { session: { findUnique: jest.fn() } };
  const service = new AccessTokenValidationService(prisma as never);
  const payload: AccessTokenPayload = {
    sub: '00000000-0000-4000-8000-000000000001',
    sid: '00000000-0000-4000-8000-000000000002',
    typ: JwtTokenType.ACCESS,
    ver: 0,
  };

  beforeEach(() => jest.clearAllMocks());

  it('returns a principal from an active session and database permissions', async () => {
    prisma.session.findUnique.mockResolvedValue({
      userId: payload.sub,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: {
        id: payload.sub,
        email: 'user@example.test',
        emailVerifiedAt: new Date(),
        status: 'ACTIVE',
        deletedAt: null,
        authorProfile: null,
        userRoles: [
          {
            role: {
              code: RoleCode.USER,
              permissions: [
                { permission: { code: PermissionCode.MEDIA_UPLOAD } },
              ],
            },
          },
        ],
      },
    });

    await expect(service.validate(payload)).resolves.toMatchObject({
      userId: payload.sub,
      sessionId: payload.sid,
      roles: [RoleCode.USER],
      permissions: [PermissionCode.MEDIA_UPLOAD],
    });
  });

  it('rejects a refresh token payload', async () => {
    await expect(
      service.validate({ ...payload, typ: JwtTokenType.REFRESH } as never),
    ).rejects.toBeDefined();
    expect(prisma.session.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a revoked session', async () => {
    prisma.session.findUnique.mockResolvedValue({
      userId: payload.sub,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      user: { status: 'ACTIVE', deletedAt: null },
    });
    await expect(service.validate(payload)).rejects.toBeDefined();
  });
});

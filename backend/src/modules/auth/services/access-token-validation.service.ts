import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';

import { JwtTokenType, PermissionCode, RoleCode } from '@/common/enums';
import { InvalidTokenException } from '@/common/exceptions';
import type {
  AccessTokenPayload,
  AuthPrincipal,
} from '@/common/interfaces/auth';
import { AccountStatus } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma';

@Injectable()
export class AccessTokenValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(payload: AccessTokenPayload): Promise<AuthPrincipal> {
    if (
      !payload ||
      payload.typ !== JwtTokenType.ACCESS ||
      !isUUID(payload.sub) ||
      !isUUID(payload.sid) ||
      !Number.isSafeInteger(payload.ver) ||
      payload.ver < 0
    ) {
      throw new InvalidTokenException({
        message: 'Access token payload không hợp lệ',
      });
    }

    const now = new Date();
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      select: {
        userId: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
            status: true,
            deletedAt: true,
            authorProfile: { select: { userId: true } },
            userRoles: {
              where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
              select: {
                role: {
                  select: {
                    code: true,
                    permissions: {
                      select: { permission: { select: { code: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.user.deletedAt ||
      session.user.status !== AccountStatus.ACTIVE
    ) {
      throw new InvalidTokenException({
        message: 'Access token không còn hiệu lực',
      });
    }

    const validRoles = new Set<string>(Object.values(RoleCode));
    const validPermissions = new Set<string>(Object.values(PermissionCode));
    const roles = session.user.userRoles
      .map(({ role }) => role.code)
      .filter((code): code is RoleCode => validRoles.has(code));
    const permissions = [
      ...new Set(
        session.user.userRoles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.code),
        ),
      ),
    ].filter((code): code is PermissionCode => validPermissions.has(code));

    return {
      userId: session.user.id,
      sessionId: payload.sid,
      email: session.user.email,
      emailVerified: Boolean(session.user.emailVerifiedAt),
      roles,
      permissions,
      authorProfileId: session.user.authorProfile?.userId,
    };
  }
}

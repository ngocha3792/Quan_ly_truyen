import { Injectable } from '@nestjs/common';

import { PermissionCode, RoleCode } from '@/common/enums';
import { PrismaService } from '@/infrastructure/database';

import type {
  AccessSessionReaderPort,
  AccessSessionSnapshot,
} from '../../../../application/ports';
import { AuthAccountStatus } from '../../../../domain/enums';

@Injectable()
export class PrismaAccessSessionReader implements AccessSessionReaderPort {
  constructor(private readonly prisma: PrismaService) {}

  async findBySessionId(
    sessionId: string,
  ): Promise<AccessSessionSnapshot | null> {
    const now = new Date();

    const session = await this.prisma.session.findUnique({
      where: {
        id: sessionId,
      },
      select: {
        id: true,
        userId: true,
        accessTokenVersion: true,
        expiresAt: true,
        revokedAt: true,

        user: {
          select: {
            email: true,
            emailVerifiedAt: true,
            status: true,
            deletedAt: true,

            authorProfile: {
              select: {
                userId: true,
              },
            },

            userRoles: {
              where: {
                OR: [
                  {
                    expiresAt: null,
                  },
                  {
                    expiresAt: {
                      gt: now,
                    },
                  },
                ],
              },
              select: {
                role: {
                  select: {
                    code: true,

                    permissions: {
                      select: {
                        permission: {
                          select: {
                            code: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      return null;
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
      sessionId: session.id,
      userId: session.userId,

      accessTokenVersion: session.accessTokenVersion,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,

      email: session.user.email,
      emailVerifiedAt: session.user.emailVerifiedAt,
      accountStatus: session.user.status as AuthAccountStatus,
      userDeletedAt: session.user.deletedAt,

      roles,
      permissions,

      authorProfileId: session.user.authorProfile?.userId,
    };
  }
}

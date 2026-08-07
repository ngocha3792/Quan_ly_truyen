import { Injectable } from '@nestjs/common';

import { PermissionCode, RoleCode } from '@/common/enums';

import { PrismaService } from '@/infrastructure/database';
import { MfaCredentialStatus, MfaMethod } from '@/generated/prisma/client';
import type {
  AccessSessionReaderPort,
  AccessSessionSnapshot,
} from '../../../../application/ports';

import { AuthAccountStatus } from '../../../../domain/enums';

import {
  AccessAuthorizationCacheService,
  type AccessAuthorizationSnapshot,
} from '../../../cache';

@Injectable()
export class PrismaAccessSessionReader implements AccessSessionReaderPort {
  constructor(
    private readonly prisma: PrismaService,

    private readonly authorizationCache: AccessAuthorizationCacheService,
  ) {}

  async findBySessionId(
    sessionId: string,
  ): Promise<AccessSessionSnapshot | null> {
    /*
     * Phần security-sensitive luôn đọc trực tiếp
     * PostgreSQL.
     *
     * Logout/change-password/revoke-session vì vậy
     * vẫn có hiệu lực ngay.
     */
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
        mfaVerifiedAt: true,

        user: {
          select: {
            email: true,

            emailVerifiedAt: true,

            status: true,

            deletedAt: true,
            mfaCredentials: {
              where: {
                method: MfaMethod.TOTP,

                status: MfaCredentialStatus.ENABLED,

                disabledAt: null,
              },

              take: 1,

              select: {
                id: true,
              },
            },

            adminMfaCredential: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    const authorization = await this.readAuthorization(session.userId);

    return {
      sessionId: session.id,

      userId: session.userId,

      accessTokenVersion: session.accessTokenVersion,

      expiresAt: session.expiresAt,

      revokedAt: session.revokedAt,
      mfaVerifiedAt: session.mfaVerifiedAt,
      mfaEnabled:
        session.user.mfaCredentials.length > 0 ||
        session.user.adminMfaCredential !== null,

      email: session.user.email,

      emailVerifiedAt: session.user.emailVerifiedAt,

      accountStatus: session.user.status as AuthAccountStatus,

      userDeletedAt: session.user.deletedAt,

      roles: authorization.roles,

      permissions: authorization.permissions,

      authorProfileId: authorization.authorProfileId,
    };
  }

  private async readAuthorization(
    userId: string,
  ): Promise<AccessAuthorizationSnapshot> {
    const cached = await this.authorizationCache.get(userId);

    if (cached) {
      return cached;
    }

    const now = new Date();

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
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
            /*
             * Cần expiresAt để giới hạn TTL cache.
             */
            expiresAt: true,

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
    });

    /*
     * Session FK đảm bảo user thường phải tồn tại.
     * Empty snapshot vẫn an toàn hơn throw lỗi không cần thiết.
     */
    if (!user) {
      return {
        roles: [],

        permissions: [],
      };
    }

    const validRoles = new Set<string>(Object.values(RoleCode));

    const validPermissions = new Set<string>(Object.values(PermissionCode));

    const roles = user.userRoles
      .map(({ role }) => role.code)
      .filter((code): code is RoleCode => validRoles.has(code));

    const permissions = [
      ...new Set(
        user.userRoles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.code),
        ),
      ),
    ].filter((code): code is PermissionCode => validPermissions.has(code));

    const snapshot: AccessAuthorizationSnapshot = {
      roles,

      permissions,

      authorProfileId: user.authorProfile?.userId,
    };

    await this.authorizationCache.set(
      userId,

      snapshot,

      secondsUntilNearestRoleExpiry(
        user.userRoles.map(({ expiresAt }) => expiresAt),

        now,
      ),
    );

    return snapshot;
  }
}

function secondsUntilNearestRoleExpiry(
  expirations: readonly (Date | null)[],

  now: Date,
): number | undefined {
  return expirations
    .filter((value): value is Date => value !== null)
    .map((value) => Math.ceil((value.getTime() - now.getTime()) / 1000))
    .filter((seconds) => seconds > 0)
    .sort((left, right) => left - right)[0];
}

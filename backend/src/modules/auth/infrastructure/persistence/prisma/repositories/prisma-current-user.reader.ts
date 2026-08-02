import { Injectable } from '@nestjs/common';

import { PermissionCode, RoleCode } from '@/common/enums';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  AuthAuthorVerificationStatus,
  CurrentUserReaderPort,
  CurrentUserRecord,
} from '../../../../application/ports';
import { AuthAccountStatus } from '../../../../domain/enums';

@Injectable()
export class PrismaCurrentUserReader implements CurrentUserReaderPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string): Promise<CurrentUserRecord | null> {
    try {
      const now = new Date();

      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          deletedAt: null,
        },

        select: {
          id: true,

          email: true,
          username: true,
          displayName: true,
          bio: true,

          status: true,

          emailVerifiedAt: true,
          lastLoginAt: true,

          createdAt: true,
          updatedAt: true,

          avatarMedia: {
            select: {
              id: true,
              secureUrl: true,
              publicUrl: true,
            },
          },

          authorProfile: {
            select: {
              userId: true,
              penName: true,
              verificationStatus: true,
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
      });

      if (!user) {
        return null;
      }

      const validRoles = new Set<string>(Object.values(RoleCode));

      const validPermissions = new Set<string>(Object.values(PermissionCode));

      const roles = [
        ...new Set(user.userRoles.map(({ role }) => role.code)),
      ].filter((code): code is RoleCode => validRoles.has(code));

      const permissions = [
        ...new Set(
          user.userRoles.flatMap(({ role }) =>
            role.permissions.map(({ permission }) => permission.code),
          ),
        ),
      ].filter((code): code is PermissionCode => validPermissions.has(code));

      return {
        id: user.id,

        email: user.email,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,

        status: user.status as AuthAccountStatus,

        emailVerifiedAt: user.emailVerifiedAt,

        lastLoginAt: user.lastLoginAt,

        avatar: user.avatarMedia
          ? {
              id: user.avatarMedia.id,

              url: user.avatarMedia.secureUrl ?? user.avatarMedia.publicUrl,
            }
          : null,

        authorProfile: user.authorProfile
          ? {
              id: user.authorProfile.userId,

              penName: user.authorProfile.penName,

              verificationStatus: user.authorProfile
                .verificationStatus as AuthAuthorVerificationStatus,
            }
          : null,

        roles,
        permissions,

        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-read-current-user',

        resource: 'Người dùng hiện tại',
      });
    }
  }
}

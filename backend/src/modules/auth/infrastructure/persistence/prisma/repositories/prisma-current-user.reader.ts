import { Injectable } from '@nestjs/common';

import { PermissionCode, RoleCode } from '@/common/enums';

import { Prisma } from '@/generated/prisma/client';

import {
  CURRENT_USER_PROFILE_SELECT,
  mapPrismaError,
  PrismaService,
} from '@/infrastructure/database';

import type {
  CurrentUserReaderPort,
  CurrentUserRecord,
} from '../../../../application/ports';

import { AuthAccountStatus } from '../../../../domain/enums';

const CURRENT_USER_SELECT = {
  ...CURRENT_USER_PROFILE_SELECT,

  authorProfile: {
    select: {
      userId: true,

      penName: true,

      verificationStatus: true,
    },
  },

  userRoles: {
    /*
     * `where` được gắn lúc query vì phụ thuộc thời điểm now.
     *
     * Ở select chỉ khai báo shape relation.
     */
    select: {
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
} satisfies Prisma.UserSelect;

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
          ...CURRENT_USER_SELECT,

          /*
           * Override relation để filter role đã hết hạn.
           *
           * Profile fields phía trên vẫn lấy từ
           * CURRENT_USER_PROFILE_SELECT.
           */
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

            select: CURRENT_USER_SELECT.userRoles.select,
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

              verificationStatus: user.authorProfile.verificationStatus,
            }
          : null,

        roles,

        permissions,

        createdAt: user.createdAt,

        updatedAt: user.updatedAt,
      };
    } catch (error: unknown) {
      throw mapPrismaError(
        error,

        {
          operation: 'auth-read-current-user',

          resource: 'Người dùng hiện tại',
        },
      );
    }
  }
}

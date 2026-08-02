import { Injectable } from '@nestjs/common';

import { RoleCode } from '@/common/enums';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  CreateLoginSessionInput,
  LoginAccountRecord,
  LoginPersistencePort,
} from '../../../../application/ports';
import { AuthAccountStatus } from '../../../../domain/enums';

@Injectable()
export class PrismaLoginPersistence implements LoginPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async findAccountByIdentifier(
    identifier: string,
  ): Promise<LoginAccountRecord | null> {
    const now = new Date();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          {
            email: {
              equals: identifier,
              mode: 'insensitive',
            },
          },
          {
            username: {
              equals: identifier,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        passwordHash: true,
        status: true,
        deletedAt: true,
        emailVerifiedAt: true,

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
              },
            },
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    const validRoleCodes = new Set<string>(Object.values(RoleCode));

    const roles = user.userRoles
      .map(({ role }) => role.code)
      .filter((code): code is RoleCode => validRoleCodes.has(code));

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      passwordHash: user.passwordHash,

      status: user.status as AuthAccountStatus,
      deletedAt: user.deletedAt,
      emailVerifiedAt: user.emailVerifiedAt,

      roles,
    };
  }

  async createSession(input: CreateLoginSessionInput): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.session.create({
          data: {
            id: input.id,
            userId: input.userId,

            refreshTokenHash: input.refreshTokenHash,
            refreshTokenFamilyId: input.refreshTokenFamilyId,
            refreshTokenVersion: input.refreshTokenVersion,
            accessTokenVersion: input.accessTokenVersion,

            deviceId: input.deviceId,
            deviceName: input.deviceName,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,

            lastUsedAt: input.loggedInAt,
            expiresAt: input.expiresAt,
          },
        });

        await tx.user.update({
          where: {
            id: input.userId,
          },
          data: {
            lastLoginAt: input.loggedInAt,
          },
        });
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-create-login-session',
        resource: 'Phiên đăng nhập',
      });
    }
  }
}

import { Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { RoleCode } from '@/common/enums';

import type { AuthConfig } from '@/config';

import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  CreateLoginSessionInput,
  LoginAccountRecord,
  LoginPersistencePort,
} from '../../../../application/ports';

import { MfaCredentialStatus, MfaMethod } from '@/generated/prisma/client';

import {
  AuthAccountStatus,
  AuthAuditAction,
  SessionRevocationReason,
} from '../../../../domain/enums';

import { PrismaAuthAuditWriterAdapter } from '../../../audit';

@Injectable()
export class PrismaLoginPersistence implements LoginPersistencePort {
  private readonly maxActiveSessions: number;

  constructor(
    private readonly prisma: PrismaService,

    configService: ConfigService,

    private readonly auditWriter: PrismaAuthAuditWriterAdapter,
  ) {
    const config = configService.getOrThrow<AuthConfig>('auth');

    this.maxActiveSessions = config.sessions.maxActiveSessions;
  }

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

        /*
         * Legacy compatibility.
         */
        adminMfaCredential: {
          select: {
            id: true,
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
      mfaEnabled:
        user.mfaCredentials.length > 0 || user.adminMfaCredential !== null,
    };
  }

  async createSession(input: CreateLoginSessionInput): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        /*
         * Update user trước để PostgreSQL giữ row lock
         * cho user này trong toàn bộ transaction.
         *
         * Nếu cùng một tài khoản đăng nhập đồng thời,
         * các transaction sẽ chạy tuần tự tại đây.
         *
         * Nhờ vậy không xảy ra tình trạng:
         * - cả hai request cùng đọc số session cũ;
         * - cả hai cùng tạo session;
         * - cuối cùng vượt AUTH_MAX_ACTIVE_SESSIONS.
         */
        await tx.user.update({
          where: {
            id: input.userId,
          },

          data: {
            lastLoginAt: input.loggedInAt,
          },
        });

        /*
         * Tạo session mới trong cùng transaction.
         */
        await tx.session.create({
          data: {
            id: input.id,
            userId: input.userId,

            refreshTokenHash: input.refreshTokenHash,
            refreshTokenFamilyId: input.refreshTokenFamilyId,
            refreshTokenVersion: input.refreshTokenVersion,
            accessTokenVersion: input.accessTokenVersion,
            mfaVerifiedAt: input.mfaVerifiedAt,

            deviceId: input.deviceId,
            deviceName: input.deviceName,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,

            lastUsedAt: input.loggedInAt,
            expiresAt: input.expiresAt,
          },
        });

        /*
         * Chỉ tính các session:
         * - chưa bị revoke;
         * - chưa hết hạn.
         */
        const activeSessionWhere = {
          userId: input.userId,

          revokedAt: null,

          expiresAt: {
            gt: input.loggedInAt,
          },
        } as const;

        const activeSessionCount = await tx.session.count({
          where: activeSessionWhere,
        });

        /*
         * Ví dụ:
         *
         * max = 2
         * active sau khi tạo session mới = 3
         * overflow = 1
         *
         * Khi đó revoke một session cũ nhất.
         */
        const overflowCount = Math.max(
          0,
          activeSessionCount - this.maxActiveSessions,
        );

        let revokedSessionCount = 0;

        if (overflowCount > 0) {
          /*
           * Session cũ nhất được xác định bằng createdAt.
           *
           * id được dùng làm tie-breaker để kết quả luôn
           * deterministic nếu hai session có cùng createdAt.
           *
           * Session vừa tạo sẽ là session mới nhất nên sẽ
           * không tự bị revoke.
           */
          const sessionsToRevoke = await tx.session.findMany({
            where: activeSessionWhere,

            select: {
              id: true,
            },

            orderBy: [
              {
                createdAt: 'asc',
              },
              {
                id: 'asc',
              },
            ],

            take: overflowCount,
          });

          const sessionIdsToRevoke = sessionsToRevoke.map(
            (session) => session.id,
          );

          if (sessionIdsToRevoke.length > 0) {
            /*
             * updateMany kèm điều kiện revokedAt=null để tránh
             * ghi đè lên session vừa bị một luồng khác revoke.
             */
            const revokeResult = await tx.session.updateMany({
              where: {
                id: {
                  in: sessionIdsToRevoke,
                },

                userId: input.userId,

                revokedAt: null,

                expiresAt: {
                  gt: input.loggedInAt,
                },
              },

              data: {
                revokedAt: input.loggedInAt,

                revokedReason: SessionRevocationReason.SESSION_LIMIT_EXCEEDED,

                lastUsedAt: input.loggedInAt,

                /*
                 * Tăng version để các token gắn với session cũ
                 * không còn hợp lệ.
                 */
                accessTokenVersion: {
                  increment: 1,
                },

                refreshTokenVersion: {
                  increment: 1,
                },
              },
            });

            revokedSessionCount = revokeResult.count;
          }

          /*
           * Audit việc hệ thống tự thu hồi session cũ.
           *
           * Audit nằm cùng transaction nên nếu ghi audit lỗi,
           * cả việc tạo session và revoke đều rollback.
           */
          if (revokedSessionCount > 0) {
            await this.auditWriter.write(
              tx,

              {
                actorId: input.userId,

                actorSessionId: input.id,

                action: AuthAuditAction.SESSION_LIMIT_ENFORCED,

                entityType: 'user',

                entityId: input.userId,

                oldValues: {
                  activeSessionCount,
                },

                newValues: {
                  activeSessionCount: activeSessionCount - revokedSessionCount,

                  revokedSessionCount,

                  revokedReason: SessionRevocationReason.SESSION_LIMIT_EXCEEDED,
                },

                metadata: {
                  maxActiveSessions: this.maxActiveSessions,
                },

                ipAddress: input.ipAddress,

                userAgent: input.userAgent,
              },
            );
          }
        }

        /*
         * Ghi audit đăng nhập thành công.
         *
         * Integration test hiện tại của project đã yêu cầu
         * event auth.login.succeeded nhưng implementation cũ
         * chưa ghi event này.
         */
        await this.auditWriter.write(
          tx,

          {
            actorId: input.userId,

            actorSessionId: input.id,

            action: AuthAuditAction.LOGIN_SUCCEEDED,

            entityType: 'session',

            entityId: input.id,

            newValues: {
              status: 'active',

              loggedInAt: input.loggedInAt,

              expiresAt: input.expiresAt,
            },

            metadata: {
              deviceId: input.deviceId,

              deviceName: input.deviceName,

              sessionLimitEnforced: revokedSessionCount > 0,

              authenticationMethod: input.authenticationMethod ?? 'password',

              mfaVerified: input.mfaVerifiedAt !== undefined,
            },

            ipAddress: input.ipAddress,

            userAgent: input.userAgent,
          },
        );
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-create-login-session',

        resource: 'Phiên đăng nhập',
      });
    }
  }
}

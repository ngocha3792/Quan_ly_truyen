import { Injectable } from '@nestjs/common';

import { AccountStatus, Prisma } from '@/generated/prisma/client';

import { RoleCode } from '@/common/enums';

import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  ChangeManagedUserRolePersistenceInput,
  ChangeManagedUserRolePersistenceResult,
  ListManagedUsersReadInput,
  ListManagedUsersReadResult,
  ManagedUserPersistencePort,
  ManagedUserReaderPort,
  UpdateManagedUserStatusPersistenceInput,
  UpdateManagedUserStatusPersistenceResult,
} from '../../application/ports';

import {
  ManagedUserAdministrationPolicy,
  ManagedUserDetailEntity,
  ManagedUserRoleEntity,
  ManagedUserStatus,
  ManagedUserSummaryEntity,
} from '../../domain';

const MANAGED_USER_SELECT = {
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

  deletedAt: true,

  avatarMedia: {
    select: {
      id: true,

      secureUrl: true,

      publicUrl: true,
    },
  },

  adminMfaCredential: { select: { id: true } },

  mfaCredentials: { select: { status: true } },

  authorProfile: {
    select: {
      /*
       * AuthorProfile KHÔNG có id.
       *
       * userId chính là primary key.
       */
      userId: true,

      penName: true,

      verificationStatus: true,
    },
  },

  userRoles: {
    select: {
      assignedAt: true,

      expiresAt: true,

      role: {
        select: {
          code: true,

          name: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

type ManagedUserRecord = Prisma.UserGetPayload<{
  select: typeof MANAGED_USER_SELECT;
}>;

@Injectable()
export class PrismaManagedUserRepository
  implements ManagedUserReaderPort, ManagedUserPersistencePort
{
  constructor(private readonly prisma: PrismaService) {}

  async listManagedUsers(
    input: ListManagedUsersReadInput,
  ): Promise<ListManagedUsersReadResult> {
    try {
      const keyword = input.keyword?.trim();

      const where: Prisma.UserWhereInput = {
        ...(input.status
          ? {
              status: toPrismaAccountStatus(input.status),
            }
          : {}),

        ...(keyword
          ? {
              OR: [
                ...(looksLikeUuid(keyword) ? [{ id: keyword }] : []),
                {
                  email: {
                    contains: keyword,

                    mode: 'insensitive',
                  },
                },

                {
                  username: {
                    contains: keyword,

                    mode: 'insensitive',
                  },
                },

                {
                  displayName: {
                    contains: keyword,

                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),

        ...(input.role
          ? {
              userRoles: {
                some: {
                  role: {
                    code: input.role,
                  },

                  OR: [
                    {
                      expiresAt: null,
                    },

                    {
                      expiresAt: {
                        gt: input.now,
                      },
                    },
                  ],
                },
              },
            }
          : {}),
      };

      const [total, records] = await Promise.all([
        this.prisma.user.count({
          where,
        }),

        this.prisma.user.findMany({
          where,

          orderBy: [
            {
              createdAt: 'desc',
            },

            {
              id: 'asc',
            },
          ],

          skip: input.offset,

          take: input.limit,

          select: MANAGED_USER_SELECT,
        }),
      ]);

      return {
        total,

        users: records.map((record) =>
          this.toSummaryEntity(
            record,

            input.now,
          ),
        ),
      };
    } catch (error: unknown) {
      throw mapPrismaError(
        error,

        {
          operation: 'managed-user-list',

          resource: 'Người dùng',
        },
      );
    }
  }

  async findManagedUserById(
    userId: string,

    now: Date,
  ): Promise<ManagedUserDetailEntity | null> {
    try {
      const record = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: MANAGED_USER_SELECT,
      });

      if (!record) {
        return null;
      }

      const [activeSessionCount, statusReason] = await Promise.all([
        this.prisma.session.count({ where: { userId, revokedAt: null, expiresAt: { gt: now } } }),
        this.loadLatestStatusReason(this.prisma, userId),
      ]);

      return this.toDetailEntity(record, now, activeSessionCount, statusReason);
    } catch (error: unknown) {
      throw mapPrismaError(
        error,

        {
          operation: 'managed-user-detail',

          resource: 'Người dùng',
        },
      );
    }
  }

  async updateManagedUserStatus(
    input: UpdateManagedUserStatusPersistenceInput,
  ): Promise<UpdateManagedUserStatusPersistenceResult> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        /*
         * Serialize các operation có khả
         * năng làm thay đổi số admin ACTIVE.
         */
        await lockManagedUserAdministration(transaction);

        /*
         * Lock target row.
         *
         * Chỉ SELECT id bằng raw SQL.
         * Không đọc status enum bằng raw SQL
         * vì database enum lưu "active",
         * trong khi Prisma enum là "ACTIVE".
         */
        const locked = await lockManagedUserRow(
          transaction,

          input.targetUserId,
        );

        if (!locked) {
          return {
            status: 'not_found',
          };
        }

        /*
         * Sau khi row đã bị FOR UPDATE,
         * đọc lại bằng Prisma để enum mapping
         * chính xác.
         */
        const current = await transaction.user.findUnique({
          where: {
            id: input.targetUserId,
          },

          select: {
            status: true,

            deletedAt: true,
          },
        });

        if (!current) {
          return {
            status: 'not_found',
          };
        }

        const currentStatus = toDomainManagedUserStatus(current.status);

        if (
          ManagedUserAdministrationPolicy.isDeleted(
            currentStatus,
            current.deletedAt,
          )
        ) {
          return {
            status: 'deleted',
          };
        }

        const nextStatus = toPrismaAccountStatus(input.status);
        const hasActiveAdminRole =
          currentStatus === ManagedUserStatus.ACTIVE &&
          input.status !== ManagedUserStatus.ACTIVE
            ? await this.hasActiveAdminRole(
                transaction,
                input.targetUserId,
                input.changedAt,
              )
            : false;
        const activeAdminCount = hasActiveAdminRole
          ? await this.countActiveAdmins(transaction, input.changedAt)
          : 0;
        const statusTransition =
          ManagedUserAdministrationPolicy.decideStatusTransition({
            currentStatus,
            nextStatus: input.status,
            hasActiveAdminRole,
            activeAdminCount,
          });

        if (statusTransition === 'unchanged') {
          return {
            status: 'unchanged',

            user: await this.loadDetailInTransaction(
              transaction,

              input.targetUserId,

              input.changedAt,
            ),
          };
        }

        /*
         * ACTIVE admin -> SUSPENDED/BANNED
         *
         * Phải đảm bảo vẫn còn ít nhất
         * một ACTIVE admin khác.
         */
        if (statusTransition === 'last_active_admin') {
          return {
            status: 'last_active_admin',
          };
        }

        await transaction.user.update({
          where: {
            id: input.targetUserId,
          },

          data: {
            status: nextStatus,

            updatedAt: input.changedAt,
          },
        });

        let sessionsRevoked = 0;

        /*
         * Khi suspend/ban:
         *
         * - access token version tăng
         * - refresh version tăng
         * - session revoked
         *
         * Không chỉ dựa vào cache.
         */
        if (
          ManagedUserAdministrationPolicy.shouldRevokeSessions(input.status)
        ) {
          const result = await transaction.session.updateMany({
            where: {
              userId: input.targetUserId,

              revokedAt: null,

              expiresAt: {
                gt: input.changedAt,
              },
            },

            data: {
              revokedAt: input.changedAt,

              revokedReason:
                ManagedUserAdministrationPolicy.statusRevocationReason(
                  input.status,
                ),

              lastUsedAt: input.changedAt,

              accessTokenVersion: {
                increment: 1,
              },

              refreshTokenVersion: {
                increment: 1,
              },
            },
          });

          sessionsRevoked = result.count;
        }

        await transaction.auditLog.create({
          data: {
            actorId: input.actorUserId,

            action: 'USER_STATUS_CHANGED',

            entityType: 'user',

            entityId: input.targetUserId,

            oldValues: {
              status: current.status,
            },

            newValues: {
              status: nextStatus,

              sessionsRevoked,
            },

            metadata: { ...(input.reason ? { reason: input.reason } : {}) },

            ipAddress: input.audit.ipAddress,

            userAgent: input.audit.userAgent,

            requestId: input.audit.requestId,

            createdAt: input.changedAt,
          },
        });

        return {
          status: 'updated',

          user: await this.loadDetailInTransaction(
            transaction,

            input.targetUserId,

            input.changedAt,
          ),
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(
        error,

        {
          operation: 'managed-user-status-update',

          resource: 'Người dùng',
        },
      );
    }
  }

  async assignManagedUserRole(
    input: ChangeManagedUserRolePersistenceInput,
  ): Promise<ChangeManagedUserRolePersistenceResult> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await lockManagedUserAdministration(transaction);

        const locked = await lockManagedUserRow(
          transaction,

          input.targetUserId,
        );

        if (!locked) {
          return {
            status: 'not_found',
          };
        }

        const target = await transaction.user.findUnique({
          where: {
            id: input.targetUserId,
          },

          select: {
            status: true,

            deletedAt: true,
          },
        });

        if (!target) {
          return {
            status: 'not_found',
          };
        }

        const targetStatus = toDomainManagedUserStatus(target.status);

        if (
          ManagedUserAdministrationPolicy.isDeleted(
            targetStatus,
            target.deletedAt,
          )
        ) {
          return {
            status: 'deleted',
          };
        }

        /*
         * Defense in depth.
         *
         * Handler đã chặn USER/AUTHOR,
         * persistence vẫn không tin caller.
         */
        if (
          !ManagedUserAdministrationPolicy.isDirectlyManageableRole(
            input.roleCode,
          )
        ) {
          return {
            status: 'role_protected',
          };
        }

        const role = await transaction.role.findUnique({
          where: {
            code: input.roleCode,
          },

          select: {
            id: true,
          },
        });

        if (!role) {
          return {
            status: 'role_missing',
          };
        }

        const existing = await transaction.userRole.findUnique({
          where: {
            userId_roleId: {
              userId: input.targetUserId,

              roleId: role.id,
            },
          },

          select: {
            expiresAt: true,
          },
        });

        if (
          ManagedUserAdministrationPolicy.isRoleActive(
            existing?.expiresAt,
            input.changedAt,
          )
        ) {
          return {
            status: 'unchanged',

            user: await this.loadDetailInTransaction(
              transaction,

              input.targetUserId,

              input.changedAt,
            ),
          };
        }

        await transaction.userRole.upsert({
          where: {
            userId_roleId: {
              userId: input.targetUserId,

              roleId: role.id,
            },
          },

          create: {
            userId: input.targetUserId,

            roleId: role.id,

            assignedById: input.actorUserId,

            assignedAt: input.changedAt,

            expiresAt: null,
          },

          update: {
            assignedById: input.actorUserId,

            assignedAt: input.changedAt,

            expiresAt: null,
          },
        });

        await transaction.auditLog.create({
          data: {
            actorId: input.actorUserId,

            action: 'USER_ROLE_ADDED',

            entityType: 'user',

            entityId: input.targetUserId,

            newValues: {
              roleCode: input.roleCode,
            },

            ipAddress: input.audit.ipAddress,

            userAgent: input.audit.userAgent,

            requestId: input.audit.requestId,

            createdAt: input.changedAt,
          },
        });

        return {
          status: 'updated',

          user: await this.loadDetailInTransaction(
            transaction,

            input.targetUserId,

            input.changedAt,
          ),
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(
        error,

        {
          operation: 'managed-user-role-assign',

          resource: 'Role người dùng',
        },
      );
    }
  }

  async removeManagedUserRole(
    input: ChangeManagedUserRolePersistenceInput,
  ): Promise<ChangeManagedUserRolePersistenceResult> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await lockManagedUserAdministration(transaction);

        const locked = await lockManagedUserRow(
          transaction,

          input.targetUserId,
        );

        if (!locked) {
          return {
            status: 'not_found',
          };
        }

        const target = await transaction.user.findUnique({
          where: {
            id: input.targetUserId,
          },

          select: {
            status: true,

            deletedAt: true,
          },
        });

        if (!target) {
          return {
            status: 'not_found',
          };
        }

        const targetStatus = toDomainManagedUserStatus(target.status);

        if (
          ManagedUserAdministrationPolicy.isDeleted(
            targetStatus,
            target.deletedAt,
          )
        ) {
          return {
            status: 'deleted',
          };
        }

        if (
          !ManagedUserAdministrationPolicy.isDirectlyManageableRole(
            input.roleCode,
          )
        ) {
          return {
            status: 'role_protected',
          };
        }

        const role = await transaction.role.findUnique({
          where: {
            code: input.roleCode,
          },

          select: {
            id: true,
          },
        });

        if (!role) {
          return {
            status: 'role_missing',
          };
        }

        const existing = await transaction.userRole.findUnique({
          where: {
            userId_roleId: {
              userId: input.targetUserId,

              roleId: role.id,
            },
          },

          select: {
            expiresAt: true,
          },
        });

        const isActiveRole = ManagedUserAdministrationPolicy.isRoleActive(
          existing?.expiresAt,
          input.changedAt,
        );

        if (!isActiveRole) {
          return {
            status: 'unchanged',

            user: await this.loadDetailInTransaction(
              transaction,

              input.targetUserId,

              input.changedAt,
            ),
          };
        }

        /*
         * Phải giữ lại ít nhất 1 ACTIVE admin.
         *
         * Nếu gỡ ADMIN của 1 target đang ACTIVE,
         * số lượng ACTIVE admin phải > 1.
         */
        if (targetStatus === ManagedUserStatus.ACTIVE) {
          const activeAdminCount = await this.countActiveAdmins(
            transaction,

            input.changedAt,
          );

          if (
            ManagedUserAdministrationPolicy.wouldRemoveLastActiveAdmin(
              targetStatus,
              activeAdminCount,
            )
          ) {
            return {
              status: 'last_active_admin',
            };
          }
        }

        await transaction.userRole.delete({
          where: {
            userId_roleId: {
              userId: input.targetUserId,

              roleId: role.id,
            },
          },
        });

        const revokeResult = await transaction.session.updateMany({
          where: {
            userId: input.targetUserId,

            revokedAt: null,

            expiresAt: {
              gt: input.changedAt,
            },
          },

          data: {
            revokedAt: input.changedAt,

            revokedReason: 'admin_role_removed',

            lastUsedAt: input.changedAt,

            accessTokenVersion: {
              increment: 1,
            },

            refreshTokenVersion: {
              increment: 1,
            },
          },
        });

        await transaction.auditLog.create({
          data: {
            actorId: input.actorUserId,

            action: 'USER_ROLE_REMOVED',

            entityType: 'user',

            entityId: input.targetUserId,

            newValues: {
              roleCode: input.roleCode,

              sessionsRevoked: revokeResult.count,
            },

            ipAddress: input.audit.ipAddress,

            userAgent: input.audit.userAgent,

            requestId: input.audit.requestId,

            createdAt: input.changedAt,
          },
        });

        return {
          status: 'updated',

          user: await this.loadDetailInTransaction(
            transaction,

            input.targetUserId,

            input.changedAt,
          ),
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(
        error,

        {
          operation: 'managed-user-role-remove',

          resource: 'Role người dùng',
        },
      );
    }
  }

  private async loadDetailInTransaction(
    transaction: Prisma.TransactionClient,

    userId: string,

    now: Date,
  ): Promise<ManagedUserDetailEntity> {
    const record = await transaction.user.findUniqueOrThrow({
      where: {
        id: userId,
      },

      select: MANAGED_USER_SELECT,
    });

    const [activeSessionCount, statusReason] = await Promise.all([
      transaction.session.count({ where: { userId, revokedAt: null, expiresAt: { gt: now } } }),
      this.loadLatestStatusReason(transaction, userId),
    ]);

    return this.toDetailEntity(record, now, activeSessionCount, statusReason);
  }

  private async hasActiveAdminRole(
    transaction: Prisma.TransactionClient,

    userId: string,

    now: Date,
  ): Promise<boolean> {
    const count = await transaction.userRole.count({
      where: {
        userId,

        role: {
          code: RoleCode.ADMIN,
        },

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
    });

    return count > 0;
  }

  private async countActiveAdmins(
    transaction: Prisma.TransactionClient,

    now: Date,
  ): Promise<number> {
    return transaction.user.count({
      where: {
        status: AccountStatus.ACTIVE,

        deletedAt: null,

        userRoles: {
          some: {
            role: {
              code: RoleCode.ADMIN,
            },

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
        },
      },
    });
  }

  private toSummaryEntity(
    record: ManagedUserRecord,

    now: Date,
  ): ManagedUserSummaryEntity {
    return new ManagedUserSummaryEntity(
      record.id,

      record.email,

      record.username,

      record.displayName,

      toDomainManagedUserStatus(record.status),

      record.emailVerifiedAt,

      record.lastLoginAt,

      this.toRoleEntities(
        record.userRoles,

        now,
      ),

      record.createdAt,

      record.updatedAt,
    );
  }

  private toDetailEntity(
    record: ManagedUserRecord,

    now: Date,

    activeSessionCount: number,

    statusReason: string | null,
  ): ManagedUserDetailEntity {
    return new ManagedUserDetailEntity(
      record.id,

      record.email,

      record.username,

      record.displayName,

      toDomainManagedUserStatus(record.status),

      record.emailVerifiedAt,

      record.lastLoginAt,

      this.toRoleEntities(
        record.userRoles,

        now,
      ),

      record.createdAt,

      record.updatedAt,

      record.bio,

      record.avatarMedia
        ? {
            id: record.avatarMedia.id,

            url:
              record.avatarMedia.secureUrl ??
              record.avatarMedia.publicUrl ??
              null,
          }
        : null,

      record.authorProfile
        ? {
            id: record.authorProfile.userId,

            penName: record.authorProfile.penName,

            verificationStatus: record.authorProfile.verificationStatus,
          }
        : null,

      activeSessionCount,

      statusReason,

      Boolean(record.adminMfaCredential) || record.mfaCredentials.some((credential) => credential.status === 'ENABLED'),

      record.deletedAt,
    );
  }

  private async loadLatestStatusReason(
    transaction: Pick<Prisma.TransactionClient, 'auditLog'>,
    userId: string,
  ): Promise<string | null> {
    const event = await transaction.auditLog.findFirst({
      where: { entityType: 'user', entityId: userId, action: { in: ['USER_STATUS_CHANGED', 'admin.user.status.changed'] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { metadata: true },
    });
    if (!event?.metadata || typeof event.metadata !== 'object' || Array.isArray(event.metadata)) return null;
    const reason = (event.metadata as Record<string, unknown>)['reason'];
    return typeof reason === 'string' && reason.trim() ? reason : null;
  }

  private toRoleEntities(
    userRoles: ManagedUserRecord['userRoles'],

    now: Date,
  ): readonly ManagedUserRoleEntity[] {
    return userRoles
      .filter((ur) => (ur.expiresAt === null ? true : ur.expiresAt > now))

      .map(
        (ur) =>
          new ManagedUserRoleEntity(
            ur.role.code as RoleCode,

            ur.role.name,

            ur.assignedAt,

            ur.expiresAt,
          ),
      );
  }
}

function toPrismaAccountStatus(status: ManagedUserStatus): AccountStatus {
  switch (status) {
    case ManagedUserStatus.ACTIVE:
      return AccountStatus.ACTIVE;

    case ManagedUserStatus.SUSPENDED:
      return AccountStatus.SUSPENDED;

    case ManagedUserStatus.BANNED:
      return AccountStatus.BANNED;

    case ManagedUserStatus.DELETED:
      return AccountStatus.DELETED;
  }
}

function toDomainManagedUserStatus(status: AccountStatus): ManagedUserStatus {
  switch (status) {
    case AccountStatus.ACTIVE:
      return ManagedUserStatus.ACTIVE;

    case AccountStatus.SUSPENDED:
      return ManagedUserStatus.SUSPENDED;

    case AccountStatus.BANNED:
      return ManagedUserStatus.BANNED;

    case AccountStatus.DELETED:
      return ManagedUserStatus.DELETED;
  }
}

/**
 * Serialize các mutation quản lý user
 * trong cùng 1 lock key tĩnh của Postgres.
 */
async function lockManagedUserAdministration(
  transaction: Prisma.TransactionClient,
): Promise<void> {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext('managed_user_administration_lock')
    )
  `;
}

/**
 * Lock hàng user bằng Raw SQL để bảo đảm
 * serialization với transaction khác.
 */
async function lockManagedUserRow(
  transaction: Prisma.TransactionClient,

  userId: string,
): Promise<boolean> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM users
    WHERE id = ${userId}::uuid
    FOR UPDATE
  `;

  return rows.length > 0;
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

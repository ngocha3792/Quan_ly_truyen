import { Injectable } from '@nestjs/common';

import { MediaPurpose, MediaStatus, Prisma } from '@/generated/prisma/client';

import {
  CURRENT_USER_PROFILE_SELECT,
  type CurrentUserProfileRow,
  mapPrismaError,
  PrismaService,
} from '@/infrastructure/database';

import {
  type UpdateUserPreferencesPersistenceInput,
  type UpdateUserPreferencesPersistenceResult,
  type UpdateUserProfilePersistenceInput,
  type UpdateUserProfilePersistenceResult,
  type UserProfilePersistencePort,
  type UserProfileReaderPort,
} from '../../application/ports';

import { UserPreferencesEntity, UserProfileEntity } from '../../domain';

const PROFILE_SELECT = CURRENT_USER_PROFILE_SELECT;

const PREFERENCES_SELECT = {
  emailEnabled: true,

  newChapterEnabled: true,

  preferences: true,

  updatedAt: true,
} satisfies Prisma.NotificationPreferenceSelect;

type ProfileRecord = CurrentUserProfileRow;

type PreferencesRecord = Prisma.NotificationPreferenceGetPayload<{
  select: typeof PREFERENCES_SELECT;
}>;

@Injectable()
export class PrismaUserProfileRepository
  implements UserProfileReaderPort, UserProfilePersistencePort
{
  constructor(private readonly prisma: PrismaService) {}

  async findProfileByUserId(userId: string): Promise<UserProfileEntity | null> {
    try {
      const record = await this.prisma.user.findFirst({
        where: {
          id: userId,

          deletedAt: null,
        },

        select: PROFILE_SELECT,
      });

      return record ? this.toProfileEntity(record) : null;
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'user-profile-read',

        resource: 'Hồ sơ người dùng',
      });
    }
  }

  async updateProfile(
    input: UpdateUserProfilePersistenceInput,
  ): Promise<UpdateUserProfilePersistenceResult> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.user.findFirst({
          where: {
            id: input.userId,

            deletedAt: null,
          },

          select: {
            displayName: true,

            bio: true,

            avatarMediaId: true,
          },
        });

        if (!current) {
          return {
            status: 'user_not_found',
          };
        }

        /*
         * Không cho gắn media của user khác,
         * media purpose khác hoặc media chưa READY.
         */
        if (input.avatarMediaId !== undefined && input.avatarMediaId !== null) {
          /**
           * Cleanup cũng phải UPDATE chính MediaAsset row này
           * để claim DELETING.
           *
           * FOR UPDATE biến:
           *
           * validate READY
           * -> attach avatar
           *
           * thành một critical section.
           */
          const locked = await lockMediaAssetRow(
            transaction,

            input.avatarMediaId,
          );

          if (!locked) {
            return {
              status: 'invalid_avatar',
            };
          }

          const avatar = await transaction.mediaAsset.findFirst({
            where: {
              id: input.avatarMediaId,

              uploaderId: input.userId,

              purpose: MediaPurpose.AVATAR,

              status: MediaStatus.READY,

              deletedAt: null,
            },

            select: {
              id: true,
            },
          });

          if (!avatar) {
            return {
              status: 'invalid_avatar',
            };
          }
        }

        const updated = await transaction.user.update({
          where: {
            id: input.userId,
          },

          data: {
            updatedAt: input.changedAt,

            ...(input.displayName !== undefined
              ? {
                  displayName: input.displayName,
                }
              : {}),

            ...(input.bio !== undefined
              ? {
                  bio: input.bio,
                }
              : {}),

            ...(input.avatarMediaId !== undefined
              ? {
                  avatarMediaId: input.avatarMediaId,
                }
              : {}),
          },

          select: PROFILE_SELECT,
        });

        await transaction.auditLog.create({
          data: {
            actorId: input.userId,

            action: 'user.profile.updated',

            entityType: 'user',

            entityId: input.userId,

            oldValues: {
              displayName: current.displayName,

              bio: current.bio,

              avatarMediaId: current.avatarMediaId,
            },

            newValues: {
              displayName: updated.displayName,

              bio: updated.bio,

              avatarMediaId: updated.avatarMedia?.id ?? null,
            },

            ipAddress: input.audit.ipAddress,

            userAgent: input.audit.userAgent,

            requestId: input.audit.requestId,

            createdAt: input.changedAt,
          },
        });

        return {
          status: 'updated',

          profile: this.toProfileEntity(updated),
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'user-profile-update',

        resource: 'Hồ sơ người dùng',
      });
    }
  }

  async findPreferencesByUserId(
    userId: string,
  ): Promise<UserPreferencesEntity | null> {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,

          deletedAt: null,
        },

        select: {
          notificationPreference: {
            select: PREFERENCES_SELECT,
          },
        },
      });

      if (!user) {
        return null;
      }

      if (!user.notificationPreference) {
        return UserPreferencesEntity.defaults();
      }

      return this.toPreferencesEntity(user.notificationPreference);
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'user-preferences-read',

        resource: 'Tùy chọn người dùng',
      });
    }
  }

  async updatePreferences(
    input: UpdateUserPreferencesPersistenceInput,
  ): Promise<UpdateUserPreferencesPersistenceResult> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.findFirst({
          where: {
            id: input.userId,

            deletedAt: null,
          },

          select: {
            id: true,
          },
        });

        if (!user) {
          return {
            status: 'user_not_found',
          };
        }

        /*
         * NotificationPreference là row 1-1 theo userId.
         *
         * Bảo đảm row tồn tại trước khi lock để cả request đầu tiên
         * (khi user chưa có preferences) cũng đi qua cùng critical section.
         *
         * Hai request cùng tạo preferences lần đầu:
         *
         * Request A -> INSERT
         * Request B -> ON CONFLICT chờ A commit
         *           -> DO NOTHING
         *           -> tiếp tục lock row mới nhất
         */
        await ensureNotificationPreferenceRow(
          transaction,

          input.userId,

          input.changedAt,
        );

        /*
         * Serialize read -> merge -> write.
         *
         * Đây là phần quan trọng để tránh lost update.
         *
         * showRecentActivity hiện nằm trong JSONB nên không thể đơn giản
         * chỉ PATCH từng Prisma column mà không quan tâm state hiện tại.
         *
         * FOR UPDATE bảo đảm request thứ hai chỉ được đọc preferences
         * sau khi request thứ nhất commit.
         */
        const current = await lockNotificationPreferenceRow(
          transaction,

          input.userId,
        );

        if (!current) {
          throw new Error(
            'Notification preference row is unavailable after ensure',
          );
        }

        const currentPreferences = this.toPreferencesEntity(current);

        const nextShowRecentActivity =
          input.showRecentActivity ?? currentPreferences.showRecentActivity;

        /*
         * Chỉ update field thực sự xuất hiện trong PATCH.
         *
         * Ví dụ:
         *
         * PATCH { newChapterNotifications: false }
         *
         * sẽ không ghi đè emailEnabled hay preferences JSON.
         */
        const updated = await transaction.notificationPreference.update({
          where: {
            userId: input.userId,
          },

          data: {
            updatedAt: input.changedAt,

            ...(input.allowUpdateEmails !== undefined
              ? {
                  emailEnabled: input.allowUpdateEmails,
                }
              : {}),

            ...(input.newChapterNotifications !== undefined
              ? {
                  newChapterEnabled: input.newChapterNotifications,
                }
              : {}),

            ...(input.showRecentActivity !== undefined
              ? {
                  preferences: this.mergeJsonPreferences(
                    current.preferences,

                    nextShowRecentActivity,
                  ),
                }
              : {}),
          },

          select: PREFERENCES_SELECT,
        });

        const preferences = this.toPreferencesEntity(updated);

        await transaction.auditLog.create({
          data: {
            actorId: input.userId,

            action: 'user.preferences.updated',

            entityType: 'user',

            entityId: input.userId,

            oldValues: {
              newChapterNotifications:
                currentPreferences.newChapterNotifications,

              showRecentActivity: currentPreferences.showRecentActivity,

              allowUpdateEmails: currentPreferences.allowUpdateEmails,
            },

            newValues: {
              newChapterNotifications: preferences.newChapterNotifications,

              showRecentActivity: preferences.showRecentActivity,

              allowUpdateEmails: preferences.allowUpdateEmails,
            },

            ipAddress: input.audit.ipAddress,

            userAgent: input.audit.userAgent,

            requestId: input.audit.requestId,

            createdAt: input.changedAt,
          },
        });

        return {
          status: 'updated',

          preferences,
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'user-preferences-update',

        resource: 'Tùy chọn người dùng',
      });
    }
  }

  private toProfileEntity(record: ProfileRecord): UserProfileEntity {
    return new UserProfileEntity(
      record.id,

      record.email,

      record.username,

      record.displayName,

      record.bio,

      record.status,

      record.emailVerifiedAt,

      record.lastLoginAt,

      record.avatarMedia
        ? {
            id: record.avatarMedia.id,

            url: record.avatarMedia.secureUrl ?? record.avatarMedia.publicUrl,
          }
        : null,

      record.createdAt,

      record.updatedAt,
    );
  }

  private toPreferencesEntity(
    record: PreferencesRecord,
  ): UserPreferencesEntity {
    return new UserPreferencesEntity(
      record.newChapterEnabled,

      this.readShowRecentActivity(record.preferences),

      record.emailEnabled,

      record.updatedAt,
    );
  }

  private readShowRecentActivity(value: Prisma.JsonValue | null): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return true;
    }

    const result = (value as Record<string, unknown>)['showRecentActivity'];

    return typeof result === 'boolean' ? result : true;
  }

  private mergeJsonPreferences(
    value: Prisma.JsonValue | null | undefined,

    showRecentActivity: boolean,
  ): Prisma.InputJsonObject {
    let base: Prisma.InputJsonObject = {};

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      base = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
    }

    return {
      ...base,

      showRecentActivity,
    };
  }
}

async function ensureNotificationPreferenceRow(
  tx: Prisma.TransactionClient,

  userId: string,

  changedAt: Date,
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "notification_preferences" (
      "user_id",
      "updated_at"
    )
    VALUES (
      ${userId}::uuid,
      ${changedAt}
    )
    ON CONFLICT ("user_id") DO NOTHING
  `);
}

async function lockNotificationPreferenceRow(
  tx: Prisma.TransactionClient,

  userId: string,
): Promise<PreferencesRecord | null> {
  const rows = await tx.$queryRaw<PreferencesRecord[]>(Prisma.sql`
    SELECT
      "email_enabled" AS "emailEnabled",
      "new_chapter_enabled" AS "newChapterEnabled",
      "preferences",
      "updated_at" AS "updatedAt"
    FROM "notification_preferences"
    WHERE "user_id" = ${userId}::uuid
    FOR UPDATE
  `);

  return rows[0] ?? null;
}

async function lockMediaAssetRow(
  tx: Prisma.TransactionClient,

  mediaAssetId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
    }>
  >(Prisma.sql`
      SELECT "id"
      FROM "media_assets"
      WHERE "id" = ${mediaAssetId}::uuid
      FOR UPDATE
    `);

  return rows.length === 1;
}

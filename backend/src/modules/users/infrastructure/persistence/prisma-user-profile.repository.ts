import {
    Injectable,
} from '@nestjs/common';

import {
    MediaPurpose,
    MediaStatus,
    Prisma,
} from '@/generated/prisma/client';

import {
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

import {
    UserPreferencesEntity,
    UserProfileEntity,
} from '../../domain';

const PROFILE_SELECT = {
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
} satisfies Prisma.UserSelect;

const PREFERENCES_SELECT = {
    emailEnabled: true,

    newChapterEnabled: true,

    preferences: true,

    updatedAt: true,
} satisfies Prisma.NotificationPreferenceSelect;

type ProfileRecord =
    Prisma.UserGetPayload<{
        select: typeof PROFILE_SELECT;
    }>;

type PreferencesRecord =
    Prisma.NotificationPreferenceGetPayload<{
        select: typeof PREFERENCES_SELECT;
    }>;

@Injectable()
export class PrismaUserProfileRepository
    implements
    UserProfileReaderPort,
    UserProfilePersistencePort {
    constructor(
        private readonly prisma:
            PrismaService,
    ) { }

    async findProfileByUserId(
        userId: string,
    ): Promise<UserProfileEntity | null> {
        try {
            const record =
                await this.prisma.user.findFirst({
                    where: {
                        id:
                            userId,

                        deletedAt:
                            null,
                    },

                    select:
                        PROFILE_SELECT,
                });

            return record
                ? this.toProfileEntity(
                    record,
                )
                : null;
        } catch (
        error: unknown
        ) {
            throw mapPrismaError(
                error,
                {
                    operation:
                        'user-profile-read',

                    resource:
                        'Hồ sơ người dùng',
                },
            );
        }
    }

    async updateProfile(
        input:
            UpdateUserProfilePersistenceInput,
    ): Promise<UpdateUserProfilePersistenceResult> {
        try {
            return await this.prisma.$transaction(
                async (
                    transaction,
                ) => {
                    const current =
                        await transaction.user.findFirst({
                            where: {
                                id:
                                    input.userId,

                                deletedAt:
                                    null,
                            },

                            select: {
                                displayName:
                                    true,

                                bio:
                                    true,

                                avatarMediaId:
                                    true,
                            },
                        });

                    if (!current) {
                        return {
                            status:
                                'user_not_found',
                        };
                    }

                    /*
                     * Không cho gắn media của user khác,
                     * media purpose khác hoặc media chưa READY.
                     */
                    if (
                        input.avatarMediaId !==
                        undefined &&
                        input.avatarMediaId !==
                        null
                    ) {
                        const avatar =
                            await transaction.mediaAsset.findFirst({
                                where: {
                                    id:
                                        input.avatarMediaId,

                                    uploaderId:
                                        input.userId,

                                    purpose:
                                        MediaPurpose.AVATAR,

                                    status:
                                        MediaStatus.READY,

                                    deletedAt:
                                        null,
                                },

                                select: {
                                    id:
                                        true,
                                },
                            });

                        if (!avatar) {
                            return {
                                status:
                                    'invalid_avatar',
                            };
                        }
                    }

                    const updated =
                        await transaction.user.update({
                            where: {
                                id:
                                    input.userId,
                            },

                            data: {
                                updatedAt:
                                    input.changedAt,

                                ...(input.displayName !==
                                    undefined
                                    ? {
                                        displayName:
                                            input.displayName,
                                    }
                                    : {}),

                                ...(input.bio !==
                                    undefined
                                    ? {
                                        bio:
                                            input.bio,
                                    }
                                    : {}),

                                ...(input.avatarMediaId !==
                                    undefined
                                    ? {
                                        avatarMediaId:
                                            input.avatarMediaId,
                                    }
                                    : {}),
                            },

                            select:
                                PROFILE_SELECT,
                        });

                    await transaction.auditLog.create({
                        data: {
                            actorId:
                                input.userId,

                            action:
                                'user.profile.updated',

                            entityType:
                                'user',

                            entityId:
                                input.userId,

                            oldValues: {
                                displayName:
                                    current.displayName,

                                bio:
                                    current.bio,

                                avatarMediaId:
                                    current.avatarMediaId,
                            },

                            newValues: {
                                displayName:
                                    updated.displayName,

                                bio:
                                    updated.bio,

                                avatarMediaId:
                                    updated.avatarMedia?.id ??
                                    null,
                            },

                            ipAddress:
                                input.audit.ipAddress,

                            userAgent:
                                input.audit.userAgent,

                            requestId:
                                input.audit.requestId,

                            createdAt:
                                input.changedAt,
                        },
                    });

                    return {
                        status:
                            'updated',

                        profile:
                            this.toProfileEntity(
                                updated,
                            ),
                    };
                },
            );
        } catch (
        error: unknown
        ) {
            throw mapPrismaError(
                error,
                {
                    operation:
                        'user-profile-update',

                    resource:
                        'Hồ sơ người dùng',
                },
            );
        }
    }

    async findPreferencesByUserId(
        userId: string,
    ): Promise<UserPreferencesEntity | null> {
        try {
            const user =
                await this.prisma.user.findFirst({
                    where: {
                        id:
                            userId,

                        deletedAt:
                            null,
                    },

                    select: {
                        notificationPreference: {
                            select:
                                PREFERENCES_SELECT,
                        },
                    },
                });

            if (!user) {
                return null;
            }

            if (
                !user.notificationPreference
            ) {
                return UserPreferencesEntity.defaults();
            }

            return this.toPreferencesEntity(
                user.notificationPreference,
            );
        } catch (
        error: unknown
        ) {
            throw mapPrismaError(
                error,
                {
                    operation:
                        'user-preferences-read',

                    resource:
                        'Tùy chọn người dùng',
                },
            );
        }
    }

    async updatePreferences(
        input:
            UpdateUserPreferencesPersistenceInput,
    ): Promise<UpdateUserPreferencesPersistenceResult> {
        try {
            return await this.prisma.$transaction(
                async (
                    transaction,
                ) => {
                    const user =
                        await transaction.user.findFirst({
                            where: {
                                id:
                                    input.userId,

                                deletedAt:
                                    null,
                            },

                            select: {
                                id:
                                    true,
                            },
                        });

                    if (!user) {
                        return {
                            status:
                                'user_not_found',
                        };
                    }

                    const current =
                        await transaction.notificationPreference.findUnique({
                            where: {
                                userId:
                                    input.userId,
                            },

                            select:
                                PREFERENCES_SELECT,
                        });

                    const currentPreferences =
                        current
                            ? this.toPreferencesEntity(
                                current,
                            )
                            : UserPreferencesEntity.defaults();

                    const nextNewChapterNotifications =
                        input.newChapterNotifications ??
                        currentPreferences.newChapterNotifications;

                    const nextShowRecentActivity =
                        input.showRecentActivity ??
                        currentPreferences.showRecentActivity;

                    const nextAllowUpdateEmails =
                        input.allowUpdateEmails ??
                        currentPreferences.allowUpdateEmails;

                    const jsonPreferences =
                        this.mergeJsonPreferences(
                            current?.preferences,

                            nextShowRecentActivity,
                        );

                    const updated =
                        await transaction.notificationPreference.upsert({
                            where: {
                                userId:
                                    input.userId,
                            },

                            create: {
                                userId:
                                    input.userId,

                                updatedAt:
                                    input.changedAt,

                                emailEnabled:
                                    nextAllowUpdateEmails,

                                newChapterEnabled:
                                    nextNewChapterNotifications,

                                preferences:
                                    jsonPreferences,
                            },

                            update: {
                                updatedAt:
                                    input.changedAt,

                                emailEnabled:
                                    nextAllowUpdateEmails,

                                newChapterEnabled:
                                    nextNewChapterNotifications,

                                preferences:
                                    jsonPreferences,
                            },

                            select:
                                PREFERENCES_SELECT,
                        });

                    const preferences =
                        this.toPreferencesEntity(
                            updated,
                        );

                    await transaction.auditLog.create({
                        data: {
                            actorId:
                                input.userId,

                            action:
                                'user.preferences.updated',

                            entityType:
                                'user',

                            entityId:
                                input.userId,

                            oldValues: {
                                newChapterNotifications:
                                    currentPreferences.newChapterNotifications,

                                showRecentActivity:
                                    currentPreferences.showRecentActivity,

                                allowUpdateEmails:
                                    currentPreferences.allowUpdateEmails,
                            },

                            newValues: {
                                newChapterNotifications:
                                    preferences.newChapterNotifications,

                                showRecentActivity:
                                    preferences.showRecentActivity,

                                allowUpdateEmails:
                                    preferences.allowUpdateEmails,
                            },

                            ipAddress:
                                input.audit.ipAddress,

                            userAgent:
                                input.audit.userAgent,

                            requestId:
                                input.audit.requestId,

                            createdAt:
                                input.changedAt,
                        },
                    });

                    return {
                        status:
                            'updated',

                        preferences,
                    };
                },
            );
        } catch (
        error: unknown
        ) {
            throw mapPrismaError(
                error,
                {
                    operation:
                        'user-preferences-update',

                    resource:
                        'Tùy chọn người dùng',
                },
            );
        }
    }

    private toProfileEntity(
        record:
            ProfileRecord,
    ): UserProfileEntity {
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
                    id:
                        record.avatarMedia.id,

                    url:
                        record.avatarMedia.secureUrl ??
                        record.avatarMedia.publicUrl,
                }
                : null,

            record.createdAt,

            record.updatedAt,
        );
    }

    private toPreferencesEntity(
        record:
            PreferencesRecord,
    ): UserPreferencesEntity {
        return new UserPreferencesEntity(
            record.newChapterEnabled,

            this.readShowRecentActivity(
                record.preferences,
            ),

            record.emailEnabled,

            record.updatedAt,
        );
    }

    private readShowRecentActivity(
        value:
            Prisma.JsonValue | null,
    ): boolean {
        if (
            !value ||
            typeof value !== 'object' ||
            Array.isArray(value)
        ) {
            return true;
        }

        const result =
            (
                value as Record<
                    string,
                    unknown
                >
            )['showRecentActivity'];

        return typeof result ===
            'boolean'
            ? result
            : true;
    }

    private mergeJsonPreferences(
        value:
            Prisma.JsonValue | null | undefined,

        showRecentActivity:
            boolean,
    ): Prisma.InputJsonObject {
        let base:
            Prisma.InputJsonObject =
            {};

        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value)
        ) {
            base =
                JSON.parse(
                    JSON.stringify(
                        value,
                    ),
                ) as Prisma.InputJsonObject;
        }

        return {
            ...base,

            showRecentActivity,
        };
    }
}

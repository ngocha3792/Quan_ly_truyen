import { createHash } from 'node:crypto';

import bcrypt from 'bcryptjs';
import Redis from 'ioredis';

import { AccountStatus } from '../src/generated/prisma/enums';

import {
    assertNotProduction,
} from '../scripts/shared/environment';

import {
    createScriptPrismaClient,
} from '../scripts/shared/prisma-client';

const prisma =
    createScriptPrismaClient();

const E2E_EMAIL =
    (
        process.env['E2E_USER_EMAIL'] ??
        'e2e.user@truyenhub.test'
    )
        .trim()
        .toLowerCase();

const E2E_USERNAME =
    (
        process.env['E2E_USER_USERNAME'] ??
        'e2e_user'
    ).trim();

const E2E_DISPLAY_NAME =
    (
        process.env['E2E_USER_DISPLAY_NAME'] ??
        'E2E User'
    ).trim();

const E2E_PASSWORD =
    process.env['E2E_USER_PASSWORD'] ??
    'E2eUser@2026';

async function main():
    Promise<void> {
    assertNotProduction(
        'Preparing Playwright E2E user',
    );

    const userRole =
        await prisma.role.findUnique({
            where: {
                code:
                    'USER',
            },

            select: {
                id:
                    true,
            },
        });

    if (!userRole) {
        throw new Error(
            [
                'Không tìm thấy role USER.',
                'Hãy chạy db:seed trước.',
            ].join(' '),
        );
    }

    const [
        existingByEmail,
        existingByUsername,
    ] =
        await Promise.all([
            prisma.user.findUnique({
                where: {
                    email:
                        E2E_EMAIL,
                },

                select: {
                    id:
                        true,
                },
            }),

            prisma.user.findUnique({
                where: {
                    username:
                        E2E_USERNAME,
                },

                select: {
                    id:
                        true,

                    email:
                        true,
                },
            }),
        ]);

    if (
        existingByUsername &&
        existingByUsername.id !==
        existingByEmail?.id
    ) {
        throw new Error(
            [
                `Username "${E2E_USERNAME}"`,
                'đang được sử dụng bởi một account khác.',
            ].join(' '),
        );
    }

    const passwordHash =
        await bcrypt.hash(
            E2E_PASSWORD,
            10,
        );

    const now =
        new Date();

    const user =
        await prisma.$transaction(
            async (
                transaction,
            ) => {
                const savedUser =
                    await transaction.user.upsert({
                        where: {
                            email:
                                E2E_EMAIL,
                        },

                        update: {
                            username:
                                E2E_USERNAME,

                            displayName:
                                E2E_DISPLAY_NAME,

                            passwordHash,

                            passwordUpdatedAt:
                                now,

                            emailVerifiedAt:
                                now,

                            status:
                                AccountStatus.ACTIVE,

                            deletedAt:
                                null,

                            lastLoginAt:
                                null,
                        },

                        create: {
                            email:
                                E2E_EMAIL,

                            username:
                                E2E_USERNAME,

                            displayName:
                                E2E_DISPLAY_NAME,

                            passwordHash,

                            passwordUpdatedAt:
                                now,

                            emailVerifiedAt:
                                now,

                            status:
                                AccountStatus.ACTIVE,
                        },

                        select: {
                            id:
                                true,

                            email:
                                true,

                            username:
                                true,

                            displayName:
                                true,
                        },
                    });

                /*
                 * Reset Auth state của riêng E2E user.
                 *
                 * Không đụng tới user khác.
                 */

                await transaction.session.deleteMany({
                    where: {
                        userId:
                            savedUser.id,
                    },
                });

                await transaction.userToken.deleteMany({
                    where: {
                        userId:
                            savedUser.id,
                    },
                });

                await transaction.mfaCredential.deleteMany({
                    where: {
                        userId:
                            savedUser.id,
                    },
                });

                await transaction.adminMfaCredential.deleteMany({
                    where: {
                        userId:
                            savedUser.id,
                    },
                });

                await transaction.recoveryEmail.deleteMany({
                    where: {
                        userId:
                            savedUser.id,
                    },
                });

                await transaction.userSecurityQuestion.deleteMany({
                    where: {
                        userId:
                            savedUser.id,
                    },
                });

                await transaction.accountDeletionRequest.deleteMany({
                    where: {
                        userId:
                            savedUser.id,
                    },
                });

                /*
                 * Session phải xóa trước TrustedDevice
                 * vì Session có FK tới TrustedDevice.
                 */
                await transaction.trustedDevice.deleteMany({
                    where: {
                        userId:
                            savedUser.id,
                    },
                });

                /*
                 * Làm activity E2E deterministic.
                 *
                 * Login fixture sau đó sẽ tạo
                 * auth.login.succeeded mới.
                 */
                await transaction.auditLog.deleteMany({
                    where: {
                        actorId:
                            savedUser.id,
                    },
                });

                /*
                 * E2E account luôn là USER thuần.
                 *
                 * Điều này bảo đảm test:
                 *
                 * USER -> /author-studio -> 403
                 */
                await transaction.userRole.deleteMany({
                    where: {
                        userId:
                            savedUser.id,
                    },
                });

                await transaction.userRole.create({
                    data: {
                        userId:
                            savedUser.id,

                        roleId:
                            userRole.id,
                    },
                });

                return savedUser;
            },
        );

    /*
     * Xóa rate-limit còn sót lại từ
     * những lần test sai trước đây.
     */
    await clearRedisAuthState(
        user.id,
    );

    console.log(
        [
            'Playwright E2E user ready:',
            user.email,
            `(${user.username})`,
        ].join(' '),
    );
}

async function clearRedisAuthState(
    userId: string,
): Promise<void> {
    const redisUrl =
        process.env['REDIS_URL']
            ?.trim();

    if (!redisUrl) {
        console.log(
            'REDIS_URL không có, bỏ qua Redis E2E cleanup.',
        );

        return;
    }

    const rawPrefix =
        (
            process.env[
            'REDIS_KEY_PREFIX'
            ] ??
            'qlt'
        )
            .trim()
            .replace(
                /:+$/u,
                '',
            );

    const redis =
        new Redis(
            redisUrl,
            {
                lazyConnect:
                    true,

                enableReadyCheck:
                    true,

                maxRetriesPerRequest:
                    1,

                ...(rawPrefix
                    ? {
                        keyPrefix:
                            `${rawPrefix}:`,
                    }
                    : {}),
            },
        );

    try {
        await redis.connect();

        const keys = [
            /*
             * Identifier limiter.
             */
            createIdentifierRateLimitKey(
                E2E_EMAIL,
            ),

            createIdentifierRateLimitKey(
                E2E_USERNAME,
            ),

            /*
             * Các IP loopback thường gặp
             * khi Angular proxy -> NestJS.
             */
            createIpRateLimitKey(
                '127.0.0.1',
            ),

            createIpRateLimitKey(
                '::1',
            ),

            createIpRateLimitKey(
                '::ffff:127.0.0.1',
            ),

            /*
             * USER role vừa được reset.
             * Không để cache authorization
             * cũ giữ AUTHOR/ADMIN permission.
             */
            [
                'auth',
                'access-authorization',
                'v1',
                'user',
                userId,
            ].join(':'),
        ];

        await redis.del(
            ...keys,
        );

        console.log(
            'Đã reset Redis Auth state cho E2E user.',
        );
    } finally {
        redis.disconnect();
    }
}

function createIdentifierRateLimitKey(
    identifier: string,
): string {
    return [
        'auth',
        'login',
        'failures',
        'identifier',

        sha256(
            identifier
                .trim()
                .toLowerCase(),
        ),
    ].join(':');
}

function createIpRateLimitKey(
    ipAddress: string,
): string {
    return [
        'auth',
        'login',
        'failures',
        'ip',

        sha256(
            ipAddress.trim(),
        ),
    ].join(':');
}

function sha256(
    value: string,
): string {
    return createHash(
        'sha256',
    )
        .update(
            value,
            'utf8',
        )
        .digest(
            'hex',
        );
}

main()
    .catch(
        (
            error: unknown,
        ) => {
            console.error(
                'Không thể chuẩn bị Playwright E2E user.',
                error,
            );

            process.exitCode =
                1;
        },
    )
    .finally(
        async () => {
            await prisma.$disconnect();
        },
    );
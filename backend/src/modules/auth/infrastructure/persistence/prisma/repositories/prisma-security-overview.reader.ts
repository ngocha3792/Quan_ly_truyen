import { Injectable } from '@nestjs/common';

import { MfaCredentialStatus } from '@/generated/prisma/client';

import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  SecurityOverviewReaderPort,
  SecurityOverviewRecord,
} from '../../../../application/ports';

@Injectable()
export class PrismaSecurityOverviewReader implements SecurityOverviewReaderPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(
    userId: string,
    now: Date,
  ): Promise<SecurityOverviewRecord | null> {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,

          deletedAt: null,
        },

        select: {
          passwordHash: true,

          passwordUpdatedAt: true,

          /*
           * MFA admin hiện tại.
           *
           * Giữ support trong overview để
           * admin đã bật MFA không bị UI
           * hiển thị "Chưa bật".
           */
          adminMfaCredential: {
            select: {
              enabledAt: true,
            },
          },

          /*
           * MFA chung cho user.
           *
           * Khi phần general MFA được nối,
           * security-overview không cần đổi
           * contract nữa.
           */
          mfaCredentials: {
            where: {
              status: MfaCredentialStatus.ENABLED,

              disabledAt: null,
            },

            select: {
              enabledAt: true,
            },
          },

          recoveryEmail: {
            select: {
              email: true,

              verifiedAt: true,
            },
          },

          /*
           * Overview chỉ cần biết đã thiết lập
           * hay chưa, không cần load answerHash.
           */
          securityQuestions: {
            take: 1,

            select: {
              id: true,
            },
          },

          /*
           * Chỉ đếm trusted device còn hiệu lực.
           */
          trustedDevices: {
            where: {
              revokedAt: null,

              expiresAt: {
                gt: now,
              },
            },

            select: {
              id: true,
            },
          },
        },
      });

      if (!user) {
        return null;
      }

      const mfaConfiguredAt = latestDate([
        user.adminMfaCredential?.enabledAt,

        ...user.mfaCredentials.map((credential) => credential.enabledAt),
      ]);

      const recoveryEmail = user.recoveryEmail?.email ?? null;

      return {
        passwordConfigured: user.passwordHash !== null,

        passwordUpdatedAt: user.passwordUpdatedAt,

        mfaEnabled: mfaConfiguredAt !== null,

        mfaConfiguredAt,

        recoveryEmail,

        /*
         * Phải vừa có email vừa verified.
         * Tránh state kỳ quặc:
         * verifiedAt != null nhưng email = null.
         */
        recoveryEmailVerified:
          recoveryEmail !== null && user.recoveryEmail?.verifiedAt !== null,

        securityQuestionsConfigured: user.securityQuestions.length > 0,

        trustedDeviceCount: user.trustedDevices.length,
      };
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-read-security-overview',

        resource: 'Tổng quan bảo mật',
      });
    }
  }
}

function latestDate(values: readonly (Date | null | undefined)[]): Date | null {
  let latest: Date | null = null;

  for (const value of values) {
    if (!value) {
      continue;
    }

    if (!latest || value.getTime() > latest.getTime()) {
      latest = value;
    }
  }

  return latest;
}

import { Injectable } from '@nestjs/common';

import { RoleCode } from '@/common/enums';

import { sha256 } from '@/common/utils';

import { MfaCredentialStatus, MfaMethod } from '@/generated/prisma/client';

import { PrismaService } from '@/infrastructure/database';

import type { LoginClientContext } from '../../application/commands/login/login.command';

import type { LoginAccountRecord } from '../../application/ports';

import {
  AuthAccountStatus,
  AuthAuditAction,
  SessionRevocationReason,
} from '../../domain/enums';

import { PrismaAuthAuditWriterAdapter } from '../audit';

export type MfaCredentialSource = 'general' | 'legacy-admin';

export interface MfaCredentialRecord {
  id: string;

  source: MfaCredentialSource;

  encryptedSecret: string;

  lastUsedStep: bigint | null;
}

export interface MfaPendingEnrollmentRecord {
  id: string;

  encryptedSecret: string;

  expiresAt: Date;
}

export interface MfaStatusRecord {
  enabled: boolean;

  configuredAt: Date | null;

  recoveryCodesRemaining: number;
}

@Injectable()
export class PrismaMfaPersistence {
  constructor(
    private readonly prisma: PrismaService,

    private readonly auditWriter: PrismaAuthAuditWriterAdapter,
  ) {}

  async findAccount(userId: string): Promise<LoginAccountRecord | null> {
    const now = new Date();

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
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

        /*
         * Credential mới.
         */
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
         * Legacy admin MFA.
         *
         * Giữ tạm để admin cũ không
         * bị khóa account.
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

    const validRoles = new Set<string>(Object.values(RoleCode));

    return {
      id: user.id,

      email: user.email,

      username: user.username,

      displayName: user.displayName,

      passwordHash: user.passwordHash,

      status: user.status as AuthAccountStatus,

      deletedAt: user.deletedAt,

      emailVerifiedAt: user.emailVerifiedAt,

      roles: user.userRoles
        .map(({ role }) => role.code)
        .filter((code): code is RoleCode => validRoles.has(code)),

      mfaEnabled:
        user.mfaCredentials.length > 0 || user.adminMfaCredential !== null,
    };
  }

  async findCredential(userId: string): Promise<MfaCredentialRecord | null> {
    const general = await this.prisma.mfaCredential.findFirst({
      where: {
        userId,

        method: MfaMethod.TOTP,

        status: MfaCredentialStatus.ENABLED,

        disabledAt: null,
      },

      select: {
        id: true,

        encryptedSecret: true,

        lastUsedStep: true,
      },
    });

    if (general) {
      return {
        ...general,

        source: 'general',
      };
    }

    /*
     * Compatibility với credential
     * admin cũ.
     */
    const legacy = await this.prisma.adminMfaCredential.findUnique({
      where: {
        userId,
      },

      select: {
        id: true,

        encryptedSecret: true,

        lastUsedStep: true,
      },
    });

    if (!legacy) {
      return null;
    }

    return {
      ...legacy,

      source: 'legacy-admin',
    };
  }

  async getStatus(userId: string): Promise<MfaStatusRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      return null;
    }

    const credential = await this.prisma.mfaCredential.findFirst({
      where: {
        userId,

        method: MfaMethod.TOTP,

        status: MfaCredentialStatus.ENABLED,

        disabledAt: null,
      },

      select: {
        id: true,

        enabledAt: true,
      },
    });

    if (credential) {
      const remaining = await this.prisma.mfaRecoveryCode.count({
        where: {
          credentialId: credential.id,

          usedAt: null,
        },
      });

      return {
        enabled: true,

        configuredAt: credential.enabledAt,

        recoveryCodesRemaining: remaining,
      };
    }

    const legacy = await this.prisma.adminMfaCredential.findUnique({
      where: {
        userId,
      },

      select: {
        enabledAt: true,

        recoveryCodeHashes: true,
      },
    });

    if (legacy) {
      return {
        enabled: true,

        configuredAt: legacy.enabledAt,

        recoveryCodesRemaining: legacy.recoveryCodeHashes.length,
      };
    }

    return {
      enabled: false,

      configuredAt: null,

      recoveryCodesRemaining: 0,
    };
  }

  async startEnrollment(
    userId: string,

    encryptedSecret: string,

    expiresAt: Date,
  ): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const credential = await tx.mfaCredential.upsert({
        where: {
          userId_method: {
            userId,

            method: MfaMethod.TOTP,
          },
        },

        create: {
          userId,

          method: MfaMethod.TOTP,

          status: MfaCredentialStatus.PENDING,

          encryptedSecret,

          enrollmentExpiresAt: expiresAt,
        },

        update: {
          status: MfaCredentialStatus.PENDING,

          encryptedSecret,

          enrollmentExpiresAt: expiresAt,

          enrolledDeviceName: null,

          lastUsedStep: null,

          enabledAt: null,

          disabledAt: null,
        },

        select: {
          id: true,
        },
      });

      await tx.mfaRecoveryCode.deleteMany({
        where: {
          credentialId: credential.id,
        },
      });

      return credential.id;
    });
  }

  async findPendingEnrollment(
    userId: string,

    enrollmentId: string,
  ): Promise<MfaPendingEnrollmentRecord | null> {
    const result = await this.prisma.mfaCredential.findFirst({
      where: {
        id: enrollmentId,

        userId,

        method: MfaMethod.TOTP,

        status: MfaCredentialStatus.PENDING,
      },

      select: {
        id: true,

        encryptedSecret: true,

        enrollmentExpiresAt: true,
      },
    });

    if (!result || !result.enrollmentExpiresAt) {
      return null;
    }

    return {
      id: result.id,

      encryptedSecret: result.encryptedSecret,

      expiresAt: result.enrollmentExpiresAt,
    };
  }

  async enablePendingEnrollment(
    userId: string,

    currentSessionId: string,

    enrollmentId: string,

    initialTotpStep: bigint,

    recoveryCodes: readonly string[],

    now: Date,

    deviceName: string | undefined,

    client: LoginClientContext,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      /*
       * Session phải còn active.
       */
      const session = await tx.session.findFirst({
        where: {
          id: currentSessionId,

          userId,

          revokedAt: null,

          expiresAt: {
            gt: now,
          },
        },

        select: {
          id: true,
        },
      });

      if (!session) {
        return false;
      }

      const pending = await tx.mfaCredential.findFirst({
        where: {
          id: enrollmentId,

          userId,

          method: MfaMethod.TOTP,

          status: MfaCredentialStatus.PENDING,

          enrollmentExpiresAt: {
            gt: now,
          },
        },

        select: {
          id: true,
        },
      });

      if (!pending) {
        return false;
      }

      await tx.mfaCredential.update({
        where: {
          id: enrollmentId,
        },

        data: {
          status: MfaCredentialStatus.ENABLED,

          enrollmentExpiresAt: null,

          enrolledDeviceName: deviceName,

          lastUsedStep: initialTotpStep,

          enabledAt: now,

          disabledAt: null,
        },
      });

      await tx.mfaRecoveryCode.deleteMany({
        where: {
          credentialId: enrollmentId,
        },
      });

      await tx.mfaRecoveryCode.createMany({
        data: recoveryCodes.map((code) => ({
          credentialId: enrollmentId,

          codeHash: hashRecoveryCode(code),
        })),
      });

      /*
       * Current session vừa xác minh
       * TOTP nên đánh dấu mfaVerified.
       */
      await tx.session.update({
        where: {
          id: currentSessionId,
        },

        data: {
          mfaVerifiedAt: now,
        },
      });

      /*
       * Session cũ được tạo trước khi
       * user bật MFA không được tiếp tục
       * tồn tại.
       */
      await tx.session.updateMany({
        where: {
          userId,

          id: {
            not: currentSessionId,
          },

          revokedAt: null,
        },

        data: {
          revokedAt: now,

          revokedReason: SessionRevocationReason.MFA_ENABLED,

          accessTokenVersion: {
            increment: 1,
          },

          refreshTokenVersion: {
            increment: 1,
          },
        },
      });

      await this.auditWriter.write(tx, {
        actorId: userId,

        actorSessionId: currentSessionId,

        action: AuthAuditAction.MFA_ENROLLED,

        entityType: 'mfa_credential',

        entityId: enrollmentId,

        newValues: {
          enabledAt: now,

          method: 'totp',

          recoveryCodeCount: recoveryCodes.length,
        },

        ipAddress: client.ipAddress,

        userAgent: client.userAgent,
      });

      return true;
    });
  }

  async enableFromPreAuth(
    userId: string,

    encryptedSecret: string,

    initialTotpStep: bigint,

    recoveryCodes: readonly string[],

    now: Date,

    client: LoginClientContext,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const credential = await tx.mfaCredential.upsert({
        where: {
          userId_method: {
            userId,

            method: MfaMethod.TOTP,
          },
        },

        create: {
          userId,

          method: MfaMethod.TOTP,

          status: MfaCredentialStatus.ENABLED,

          encryptedSecret,

          lastUsedStep: initialTotpStep,

          enabledAt: now,
        },

        update: {
          status: MfaCredentialStatus.ENABLED,

          encryptedSecret,

          enrollmentExpiresAt: null,

          lastUsedStep: initialTotpStep,

          enabledAt: now,

          disabledAt: null,
        },

        select: {
          id: true,
        },
      });

      await tx.mfaRecoveryCode.deleteMany({
        where: {
          credentialId: credential.id,
        },
      });

      await tx.mfaRecoveryCode.createMany({
        data: recoveryCodes.map((code) => ({
          credentialId: credential.id,

          codeHash: hashRecoveryCode(code),
        })),
      });

      /*
       * Admin bật MFA trong pre-auth:
       * revoke session cũ trước khi
       * session MFA mới được tạo.
       */
      await tx.session.updateMany({
        where: {
          userId,

          revokedAt: null,
        },

        data: {
          revokedAt: now,

          revokedReason: SessionRevocationReason.MFA_ENABLED,

          accessTokenVersion: {
            increment: 1,
          },

          refreshTokenVersion: {
            increment: 1,
          },
        },
      });

      await this.auditWriter.write(tx, {
        actorId: userId,

        action: AuthAuditAction.MFA_ENROLLED,

        entityType: 'mfa_credential',

        entityId: credential.id,

        newValues: {
          enabledAt: now,

          method: 'totp',

          recoveryCodeCount: recoveryCodes.length,
        },

        ipAddress: client.ipAddress,

        userAgent: client.userAgent,
      });
    });
  }

  async consumeTotpStep(
    credential: MfaCredentialRecord,

    step: bigint,
  ): Promise<boolean> {
    if (credential.source === 'general') {
      const result = await this.prisma.mfaCredential.updateMany({
        where: {
          id: credential.id,

          status: MfaCredentialStatus.ENABLED,

          disabledAt: null,

          OR: [
            {
              lastUsedStep: null,
            },

            {
              lastUsedStep: {
                lt: step,
              },
            },
          ],
        },

        data: {
          lastUsedStep: step,
        },
      });

      return result.count === 1;
    }

    const result = await this.prisma.adminMfaCredential.updateMany({
      where: {
        id: credential.id,

        OR: [
          {
            lastUsedStep: null,
          },

          {
            lastUsedStep: {
              lt: step,
            },
          },
        ],
      },

      data: {
        lastUsedStep: step,
      },
    });

    return result.count === 1;
  }

  async consumeRecoveryCode(
    credential: MfaCredentialRecord,

    recoveryCode: string,
  ): Promise<boolean> {
    const hash = hashRecoveryCode(recoveryCode);

    if (credential.source === 'general') {
      const result = await this.prisma.mfaRecoveryCode.updateMany({
        where: {
          credentialId: credential.id,

          codeHash: hash,

          usedAt: null,
        },

        data: {
          usedAt: new Date(),
        },
      });

      return result.count === 1;
    }

    /*
     * Legacy admin recovery codes
     * nằm trong String[].
     */
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
      }>
    >`
          UPDATE
            "admin_mfa_credentials"

          SET
            "recovery_code_hashes" =
              array_remove(
                "recovery_code_hashes",
                ${hash}
              ),

            "updated_at" =
              CURRENT_TIMESTAMP

          WHERE
            "id" =
              CAST(
                ${credential.id}
                AS UUID
              )

            AND ${hash} =
              ANY(
                "recovery_code_hashes"
              )

          RETURNING "id"
        `;

    return rows.length === 1;
  }

  async disableCredential(
    userId: string,

    credential: MfaCredentialRecord,

    now: Date,

    currentSessionId: string,

    client: LoginClientContext,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (credential.source === 'general') {
        await tx.mfaCredential.delete({
          where: {
            id: credential.id,
          },
        });
      } else {
        await tx.adminMfaCredential.delete({
          where: {
            id: credential.id,
          },
        });
      }

      /*
       * Session không còn được xem là
       * MFA verified sau khi MFA bị tắt.
       */
      await tx.session.updateMany({
        where: {
          userId,

          revokedAt: null,
        },

        data: {
          mfaVerifiedAt: null,
        },
      });

      await this.auditWriter.write(tx, {
        actorId: userId,

        actorSessionId: currentSessionId,

        action: AuthAuditAction.MFA_DISABLED,

        entityType: 'mfa_credential',

        entityId: credential.id,

        newValues: {
          disabledAt: now,

          method: 'totp',
        },

        ipAddress: client.ipAddress,

        userAgent: client.userAgent,
      });
    });
  }

  async replaceRecoveryCodes(
    userId: string,

    credential: MfaCredentialRecord,

    recoveryCodes: readonly string[],

    now: Date,

    currentSessionId: string,

    client: LoginClientContext,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (credential.source === 'general') {
        await tx.mfaRecoveryCode.deleteMany({
          where: {
            credentialId: credential.id,
          },
        });

        await tx.mfaRecoveryCode.createMany({
          data: recoveryCodes.map((code) => ({
            credentialId: credential.id,

            codeHash: hashRecoveryCode(code),
          })),
        });
      } else {
        await tx.adminMfaCredential.update({
          where: {
            id: credential.id,
          },

          data: {
            recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode),
          },
        });
      }

      await this.auditWriter.write(tx, {
        actorId: userId,

        actorSessionId: currentSessionId,

        action: AuthAuditAction.MFA_RECOVERY_CODES_REGENERATED,

        entityType: 'mfa_credential',

        entityId: credential.id,

        newValues: {
          generatedAt: now,

          recoveryCodeCount: recoveryCodes.length,
        },

        ipAddress: client.ipAddress,

        userAgent: client.userAgent,
      });
    });
  }
}

export function hashRecoveryCode(code: string): string {
  return sha256(
    code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/gu, ''),
  );
}

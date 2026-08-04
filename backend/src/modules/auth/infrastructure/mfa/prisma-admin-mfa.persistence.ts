import { Injectable } from '@nestjs/common';

import { RoleCode } from '@/common/enums';
import { sha256 } from '@/common/utils';
import { PrismaService } from '@/infrastructure/database';

import type { LoginClientContext } from '../../application/commands/login/login.command';
import type { LoginAccountRecord } from '../../application/ports';
import { AuthAccountStatus, AuthAuditAction } from '../../domain/enums';
import { AuthAuditWriterService } from '../audit';

@Injectable()
export class PrismaAdminMfaPersistence {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuthAuditWriterService,
  ) {}

  async findAccount(userId: string): Promise<LoginAccountRecord | null> {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        passwordHash: true,
        status: true,
        deletedAt: true,
        emailVerifiedAt: true,
        adminMfaCredential: { select: { enabledAt: true } },
        userRoles: {
          where: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          select: { role: { select: { code: true } } },
        },
      },
    });
    if (!user) return null;
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
      mfaEnabled: user.adminMfaCredential !== null,
    };
  }

  async findCredential(userId: string): Promise<{
    encryptedSecret: string;
    recoveryCodeHashes: string[];
    lastUsedStep: bigint | null;
  } | null> {
    return this.prisma.adminMfaCredential.findUnique({
      where: { userId },
      select: {
        encryptedSecret: true,
        recoveryCodeHashes: true,
        lastUsedStep: true,
      },
    });
  }

  async enable(
    userId: string,
    encryptedSecret: string,
    recoveryCodes: readonly string[],
    initialTotpStep: bigint,
    now: Date,
    client: LoginClientContext,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const credential = await tx.adminMfaCredential.create({
        data: {
          userId,
          encryptedSecret,
          recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode),
          lastUsedStep: initialTotpStep,
          enabledAt: now,
        },
        select: { id: true },
      });

      await this.auditWriter.write(tx, {
        actorId: userId,
        action: AuthAuditAction.MFA_ENROLLED,
        entityType: 'admin_mfa_credential',
        entityId: credential.id,
        newValues: {
          enabledAt: now,
          recoveryCodeCount: recoveryCodes.length,
        },
        ipAddress: client.ipAddress,
        userAgent: client.userAgent,
      });
    });
  }

  async consumeTotpStep(userId: string, step: bigint): Promise<boolean> {
    const result = await this.prisma.adminMfaCredential.updateMany({
      where: {
        userId,
        OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }],
      },
      data: { lastUsedStep: step },
    });
    return result.count === 1;
  }

  async consumeRecoveryCode(
    userId: string,
    recoveryCode: string,
  ): Promise<boolean> {
    const hash = hashRecoveryCode(recoveryCode);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "admin_mfa_credentials"
      SET
        "recovery_code_hashes" = array_remove("recovery_code_hashes", ${hash}),
        "updated_at" = CURRENT_TIMESTAMP
      WHERE
        "user_id" = CAST(${userId} AS UUID)
        AND ${hash} = ANY("recovery_code_hashes")
      RETURNING "id"
    `;
    return rows.length === 1;
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

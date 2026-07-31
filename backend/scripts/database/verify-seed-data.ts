import { createScriptPrismaClient } from '../shared/prisma-client';
import { ScriptError, ScriptExitCode } from '../shared/script-error';
import { runScript } from '../shared/script-runner';

const prisma = createScriptPrismaClient();

const expectedRoleCodes = ['USER', 'AUTHOR', 'ADMIN'] as const;

void runScript({
  name: 'verify-seed-data',

  async execute({ logger }) {
    const roles = await prisma.role.findMany({
      where: {
        code: {
          in: [...expectedRoleCodes],
        },
      },
      select: {
        code: true,
        isSystem: true,
        _count: {
          select: {
            permissions: true,
          },
        },
      },
    });

    const permissionCount = await prisma.permission.count();

    const roleMap = new Map(roles.map((role) => [role.code, role]));

    const missingRoles = expectedRoleCodes.filter((code) => !roleMap.has(code));

    const invalidSystemRoles = roles
      .filter((role) => !role.isSystem)
      .map((role) => role.code);

    const adminRole = roleMap.get('ADMIN');
    const adminPermissionCount = adminRole?._count.permissions ?? 0;

    logger.info('seed data checked', {
      permissionCount,
      adminPermissionCount,
      missingRoles: missingRoles.length,
      invalidSystemRoles: invalidSystemRoles.length,
    });

    if (
      permissionCount === 0 ||
      missingRoles.length > 0 ||
      invalidSystemRoles.length > 0 ||
      adminPermissionCount !== permissionCount
    ) {
      throw new ScriptError(
        'Seed data integrity check failed',
        ScriptExitCode.INTEGRITY_FAILURE,
      );
    }
  },

  cleanup: () => prisma.$disconnect(),
});

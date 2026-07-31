import 'dotenv/config';

import bcrypt from 'bcryptjs';

import { AccountStatus } from '../../src/generated/prisma/enums';
import { requireArgument, hasFlag } from '../shared/script-arguments';
import { requireEnvironmentVariable } from '../shared/environment';
import { createScriptPrismaClient } from '../shared/prisma-client';
import { ScriptError, ScriptExitCode } from '../shared/script-error';
import { runScript } from '../shared/script-runner';

const prisma = createScriptPrismaClient();

void runScript({
  name: 'create-admin',

  async execute({ logger }) {
    const email = requireArgument('email').trim().toLowerCase();
    const username = requireArgument('username').trim();
    const displayName = requireArgument('display-name').trim();
    const password = requireEnvironmentVariable('INITIAL_ADMIN_PASSWORD');

    if (password.length < 12) {
      throw new ScriptError(
        'INITIAL_ADMIN_PASSWORD must contain at least 12 characters',
        ScriptExitCode.INVALID_ARGUMENT,
      );
    }

    const dryRun = hasFlag('dry-run');
    const replacePassword = hasFlag('replace-password');

    const adminRole = await prisma.role.findUnique({
      where: {
        code: 'ADMIN',
      },
      select: {
        id: true,
      },
    });

    if (!adminRole) {
      throw new ScriptError(
        'ADMIN role does not exist. Run db:seed first.',
        ScriptExitCode.INTEGRITY_FAILURE,
      );
    }

    const matchingUsers = await prisma.user.findMany({
      where: {
        OR: [{ email }, { username }],
      },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
      },
      take: 2,
    });

    if (matchingUsers.length > 1) {
      throw new ScriptError(
        'Email and username belong to different users',
        ScriptExitCode.INTEGRITY_FAILURE,
      );
    }

    const existingUser = matchingUsers[0];

    if (
      existingUser &&
      (existingUser.email.toLowerCase() !== email ||
        existingUser.username !== username)
    ) {
      throw new ScriptError(
        'Existing user does not match both supplied email and username',
        ScriptExitCode.INTEGRITY_FAILURE,
      );
    }

    logger.info('admin change planned', {
      mode: dryRun ? 'dry-run' : 'apply',
      email,
      username,
      existingUser: Boolean(existingUser),
      replacePassword,
    });

    if (dryRun) {
      return;
    }

    const passwordHash =
      existingUser?.passwordHash && !replacePassword
        ? existingUser.passwordHash
        : await bcrypt.hash(password, 12);

    await prisma.$transaction(async (transaction) => {
      const user = existingUser
        ? await transaction.user.update({
            where: {
              id: existingUser.id,
            },
            data: {
              displayName,
              emailVerifiedAt: new Date(),
              passwordHash,
              deletedAt: null,
              status: AccountStatus.ACTIVE,
            },
            select: {
              id: true,
            },
          })
        : await transaction.user.create({
            data: {
              email,
              username,
              displayName,
              passwordHash,
              emailVerifiedAt: new Date(),
              status: AccountStatus.ACTIVE,
            },
            select: {
              id: true,
            },
          });

      await transaction.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: adminRole.id,
          },
        },
        update: {
          expiresAt: null,
        },
        create: {
          userId: user.id,
          roleId: adminRole.id,
        },
      });
    });

    logger.info('admin account is ready', {
      email,
      username,
    });
  },

  cleanup: () => prisma.$disconnect(),
});

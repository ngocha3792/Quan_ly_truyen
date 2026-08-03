import type { INestApplicationContext } from '@nestjs/common';

import { NestFactory } from '@nestjs/core';

import {
  ProductionGateModule,
  ProductionGateService,
  type ProductionGatePhase,
} from '@/infrastructure/production-gate';

import { readArgument } from '../shared/script-arguments';

import { ScriptError, ScriptExitCode } from '../shared/script-error';

import { runScript } from '../shared/script-runner';

let context: INestApplicationContext | undefined;

void runScript({
  name: 'production-gate',

  async execute({ logger }) {
    if (process.env.NODE_ENV !== 'production') {
      throw new ScriptError(
        'NODE_ENV must be production',

        ScriptExitCode.SAFETY_GUARD,
      );
    }

    const phase = parsePhase(readArgument('phase'));

    context = await NestFactory.createApplicationContext(
      ProductionGateModule,

      {
        logger: ['error', 'warn'],
      },
    );

    const report = await context.get(ProductionGateService).inspect(phase);

    for (const check of report.checks) {
      const fields = {
        status: check.status,

        durationMs: check.durationMs,

        ...(check.details ?? {}),
      };

      if (check.status === 'passed') {
        logger.info(
          `check passed: ${check.name}`,

          fields,
        );

        continue;
      }

      logger.warn(
        `check failed: ${check.name}`,

        {
          ...fields,

          message: check.message,
        },
      );
    }

    logger.info(
      'production gate summary',

      {
        phase: report.phase,

        ready: report.ready,

        checks: report.checks.length,

        failed: report.checks.filter(({ status }) => status === 'failed')
          .length,
      },
    );

    if (!report.ready) {
      throw new ScriptError(
        'Production readiness gate failed',

        ScriptExitCode.INTEGRITY_FAILURE,
      );
    }
  },

  cleanup: async () => {
    if (context) {
      await context.close();
    }
  },
});

function parsePhase(raw: string | undefined): ProductionGatePhase {
  const phase = raw ?? 'predeploy';

  if (phase !== 'predeploy' && phase !== 'postdeploy') {
    throw new ScriptError(
      '--phase must be predeploy or postdeploy',

      ScriptExitCode.INVALID_ARGUMENT,
    );
  }

  return phase;
}

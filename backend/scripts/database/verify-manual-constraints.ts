import { createScriptPrismaClient } from '../shared/prisma-client';
import { ScriptError, ScriptExitCode } from '../shared/script-error';
import { runScript } from '../shared/script-runner';

import {
  EXPECTED_PRODUCTION_CONSTRAINTS,
  EXPECTED_PRODUCTION_INDEXES,
} from '@/infrastructure/production-gate';

const prisma = createScriptPrismaClient();

const expectedIndexes = EXPECTED_PRODUCTION_INDEXES;
const expectedConstraints = EXPECTED_PRODUCTION_CONSTRAINTS;

void runScript({
  name: 'verify-manual-constraints',

  async execute({ logger }) {
    const indexes = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT indexname AS name
      FROM pg_indexes
      WHERE schemaname = current_schema()
    `;

    const constraints = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT conname AS name
      FROM pg_constraint
      WHERE connamespace = (
        SELECT oid
        FROM pg_namespace
        WHERE nspname = current_schema()
      )
    `;

    const indexNames = new Set(indexes.map((row) => row.name));
    const constraintNames = new Set(constraints.map((row) => row.name));

    const missingIndexes = expectedIndexes.filter(
      (name) => !indexNames.has(name),
    );
    const missingConstraints = expectedConstraints.filter(
      (name) => !constraintNames.has(name),
    );

    logger.info('manual database objects checked', {
      expectedIndexes: expectedIndexes.length,
      missingIndexes: missingIndexes.length,
      expectedConstraints: expectedConstraints.length,
      missingConstraints: missingConstraints.length,
    });

    if (missingIndexes.length > 0 || missingConstraints.length > 0) {
      logger.warn('missing indexes', {
        names: missingIndexes.join(','),
      });
      logger.warn('missing constraints', {
        names: missingConstraints.join(','),
      });

      throw new ScriptError(
        'Manual database constraints are incomplete',
        ScriptExitCode.INTEGRITY_FAILURE,
      );
    }
  },

  cleanup: () => prisma.$disconnect(),
});

import { createScriptPrismaClient } from '../shared/prisma-client';

const prisma = createScriptPrismaClient();

type DuplicateRow = {
  normalized_name: string;
  ids: string[];
  names: string[];
  count: bigint;
};

async function findDuplicates(
  table: 'tags' | 'categories',
): Promise<DuplicateRow[]> {
  return prisma.$queryRawUnsafe<DuplicateRow[]>(`
    SELECT
      LOWER(REGEXP_REPLACE(BTRIM(name), '[[:space:]]+', ' ', 'g')) AS normalized_name,
      ARRAY_AGG(id::text ORDER BY id) AS ids,
      ARRAY_AGG(name ORDER BY id) AS names,
      COUNT(*) AS count
    FROM ${table}
    GROUP BY LOWER(REGEXP_REPLACE(BTRIM(name), '[[:space:]]+', ' ', 'g'))
    HAVING COUNT(*) > 1
    ORDER BY normalized_name
  `);
}

async function main(): Promise<void> {
  const [tags, categories] = await Promise.all([
    findDuplicates('tags'),
    findDuplicates('categories'),
  ]);

  if (tags.length === 0 && categories.length === 0) {
    console.log('Taxonomy name preflight passed: no normalized duplicates.');
    return;
  }

  if (tags.length > 0) {
    console.error(
      '\nDuplicate tags (safe reconciliation may use explicit Tag Merge):',
    );
    for (const row of tags)
      console.error(
        `- ${row.normalized_name}: ${row.names.join(' | ')} [${row.ids.join(', ')}]`,
      );
  }

  if (categories.length > 0) {
    console.error(
      '\nDuplicate categories (manual review required; Phase 2 does not merge categories):',
    );
    for (const row of categories)
      console.error(
        `- ${row.normalized_name}: ${row.names.join(' | ')} [${row.ids.join(', ')}]`,
      );
  }

  throw new Error(
    'Taxonomy name preflight failed. Reconcile duplicates before migration.',
  );
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

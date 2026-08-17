import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';

const ROOT = resolve(process.cwd());
const MODULES_ROOT = join(ROOT, 'src', 'modules');

// Temporary baseline for legacy violations. Refactors must delete entries from this
// list; new violations are rejected immediately.
const LEGACY_APPLICATION_VIOLATIONS = new Set([
  'src/modules/moderation/application/moderation.service.ts::@/infrastructure/database',
  'src/modules/moderation/application/moderation.service.ts::@/infrastructure/observability',
  'src/modules/audit-logs/application/audit-logs.service.ts::@/infrastructure/observability',
  'src/modules/audit-logs/application/audit-logs.service.ts::../infrastructure',
  'src/modules/authors/application/services/author-lifecycle.service.ts::@/infrastructure/database',
  'src/modules/authors/application/services/author-follow.service.ts::@/infrastructure/database',
  'src/modules/authors/application/services/author-profile.service.ts::@/infrastructure/database',
  'src/modules/taxonomy/application/taxonomy.service.ts::../infrastructure',
  'src/modules/analytics/application/analytics-rate-limiter.service.ts::@/infrastructure/cache/redis/redis.constants',
  'src/modules/analytics/application/analytics-rate-limiter.service.ts::@/infrastructure/observability',
  'src/modules/analytics/application/reader-analytics-ingestion.service.ts::@/infrastructure/database',
  'src/modules/analytics/application/reader-analytics-ingestion.service.ts::@/infrastructure/observability',
  'src/modules/analytics/application/reader-analytics-ingestion.service.ts::@/infrastructure/queue',
  'src/modules/analytics/application/author-analytics.service.ts::@/infrastructure/database',
  'src/modules/auth/application/services/admin-user-security.service.ts::@/infrastructure/database',
  'src/modules/auth/application/services/admin-user-security.service.ts::../../infrastructure/audit',
  'src/modules/comments/application/comments.service.ts::@/infrastructure/database',
  'src/modules/comments/application/comments.service.ts::@/infrastructure/observability',
  'src/modules/comments/application/comment-write-abuse.service.ts::@/infrastructure/database',
  'src/modules/comments/application/abuse-rate-limiter.service.ts::@/infrastructure/cache/redis/redis.constants',
  'src/modules/comments/application/abuse-rate-limiter.service.ts::@/infrastructure/observability',
  'src/modules/taxonomy/application/taxonomy.service.ts::@/generated/prisma/client',
  'src/modules/comments/application/comment-write-abuse.service.ts::@/generated/prisma/client',
  'src/modules/comments/application/comments.service.ts::@/generated/prisma/client',
  'src/modules/moderation/application/moderation.service.ts::@/generated/prisma/client',
  'src/modules/authors/application/services/author-profile.service.ts::@/generated/prisma/client',
  'src/modules/authors/application/services/author-follow.service.ts::@/generated/prisma/client',
  'src/modules/authors/application/services/author-lifecycle.service.ts::@/generated/prisma/client',
  'src/modules/analytics/application/reader-analytics-ingestion.service.ts::@/generated/prisma/client',
]);


const LEGACY_CROSS_MODULE_VIOLATIONS = new Set([
  'src/modules/moderation/application/moderation.service.ts::@/modules/users/application',
  'src/modules/moderation/application/moderation.service.ts::@/modules/users/domain',
]);

const importPattern = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;

function toPosix(path) {
  return path.split(sep).join('/');
}

async function listTypescriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTypescriptFiles(path)));
    } else if (entry.isFile() && extname(entry.name) === '.ts') {
      files.push(path);
    }
  }

  return files;
}

function isInfrastructureImport(specifier) {
  return (
    specifier.startsWith('@/infrastructure') ||
    /(^|\/)infrastructure(?:\/|$)/.test(specifier)
  );
}

function isGeneratedPrismaImport(specifier) {
  return specifier === '@/generated/prisma/client';
}

const files = await listTypescriptFiles(MODULES_ROOT);
const violations = [];
const seenLegacy = new Set();
const seenCrossModuleLegacy = new Set();

for (const file of files) {
  const rel = toPosix(relative(ROOT, file));
  const source = await readFile(file, 'utf8');
  const imports = [...source.matchAll(importPattern)].map((match) => match[1]);

  const isDomain = rel.includes('/domain/');
  const isApplication = rel.includes('/application/');
  const moduleMatch = rel.match(/^src\/modules\/([^/]+)\//);
  const sourceModule = moduleMatch?.[1];

  for (const specifier of imports) {
    const key = `${rel}::${specifier}`;
    const crossModuleMatch = specifier.match(/^@\/modules\/([^/]+)(\/.*)$/);

    if (
      sourceModule &&
      crossModuleMatch &&
      crossModuleMatch[1] !== sourceModule
    ) {
      if (LEGACY_CROSS_MODULE_VIOLATIONS.has(key)) {
        seenCrossModuleLegacy.add(key);
      } else {
        violations.push({
          file: rel,
          specifier,
          reason:
            'modules must import another module through its public root contract',
        });
      }
    }

    if (isDomain) {
      if (
        specifier.startsWith('@nestjs/') ||
        isInfrastructureImport(specifier) ||
        isGeneratedPrismaImport(specifier)
      ) {
        violations.push({
          file: rel,
          specifier,
          reason: 'domain must not depend on NestJS, infrastructure, or Prisma',
        });
      }
      continue;
    }

    if (
      isApplication &&
      (isInfrastructureImport(specifier) || isGeneratedPrismaImport(specifier))
    ) {
      if (LEGACY_APPLICATION_VIOLATIONS.has(key)) {
        seenLegacy.add(key);
      } else {
        violations.push({
          file: rel,
          specifier,
          reason: 'application must depend on ports, not infrastructure/Prisma',
        });
      }
    }
  }
}

const staleBaseline = [...LEGACY_APPLICATION_VIOLATIONS].filter(
  (entry) => !seenLegacy.has(entry),
);
const staleCrossModuleBaseline = [...LEGACY_CROSS_MODULE_VIOLATIONS].filter(
  (entry) => !seenCrossModuleLegacy.has(entry),
);

if (staleBaseline.length > 0 || staleCrossModuleBaseline.length > 0) {
  console.error('\nArchitecture baseline contains stale entries. Remove them:');
  for (const entry of [...staleBaseline, ...staleCrossModuleBaseline].sort()) {
    console.error(`  - ${entry}`);
  }
  process.exitCode = 1;
}

if (violations.length > 0) {
  console.error('\nArchitecture boundary violations:');
  for (const violation of violations) {
    console.error(
      `  - ${violation.file}: ${violation.specifier} (${violation.reason})`,
    );
  }
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log(
    `Architecture boundaries OK (${LEGACY_APPLICATION_VIOLATIONS.size + LEGACY_CROSS_MODULE_VIOLATIONS.size} legacy violations tracked).`,
  );
}

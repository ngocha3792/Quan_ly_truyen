import { access, readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';

const ROOT = resolve(process.cwd());
const MODULES_ROOT = join(ROOT, 'src', 'modules');

const REQUIRED_MODULE_DIRECTORIES = [
  'application/commands',
  'application/dto',
  'application/mappers',
  'application/ports',
  'application/queries',
  'domain/entities',
  'domain/enums',
  'domain/events',
  'domain/exceptions',
  'domain/policies',
  'domain/repositories',
  'domain/value-objects',
  'infrastructure/cache',
  'infrastructure/persistence',
  'infrastructure/search',
  'presentation/http/controllers',
  'presentation/http/requests',
  'presentation/http/responses',
];

const importPattern = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;

function toPosix(path) {
  return path.split(sep).join('/');
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
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

async function listModuleNames() {
  const entries = await readdir(MODULES_ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function isInfrastructureImport(specifier) {
  return (
    specifier.startsWith('@/infrastructure') ||
    /(^|\/)infrastructure(?:\/|$)/.test(specifier)
  );
}

function isGeneratedPrismaImport(specifier) {
  return specifier.startsWith('@/generated/prisma');
}

const moduleNames = await listModuleNames();
const files = await listTypescriptFiles(MODULES_ROOT);
const violations = [];

for (const moduleName of moduleNames) {
  const moduleRoot = join(MODULES_ROOT, moduleName);

  for (const requiredDirectory of REQUIRED_MODULE_DIRECTORIES) {
    const fullPath = join(moduleRoot, ...requiredDirectory.split('/'));
    if (!(await pathExists(fullPath))) {
      violations.push({
        file: `src/modules/${moduleName}`,
        specifier: requiredDirectory,
        reason: 'required module directory is missing',
      });
    }
  }

  const presentationHttpRoot = join(moduleRoot, 'presentation', 'http');
  if (await pathExists(presentationHttpRoot)) {
    const httpEntries = await readdir(presentationHttpRoot, { withFileTypes: true });
    for (const entry of httpEntries) {
      if (!entry.isFile() || extname(entry.name) !== '.ts' || entry.name === 'index.ts') {
        continue;
      }

      if (entry.name.endsWith('.controller.ts')) {
        violations.push({
          file: `src/modules/${moduleName}/presentation/http/${entry.name}`,
          specifier: 'presentation/http/controllers',
          reason: 'controllers must live inside presentation/http/controllers',
        });
      } else if (entry.name.endsWith('.request.ts')) {
        violations.push({
          file: `src/modules/${moduleName}/presentation/http/${entry.name}`,
          specifier: 'presentation/http/requests',
          reason: 'request models must live inside presentation/http/requests',
        });
      } else if (entry.name.endsWith('.response.ts')) {
        violations.push({
          file: `src/modules/${moduleName}/presentation/http/${entry.name}`,
          specifier: 'presentation/http/responses',
          reason: 'response models must live inside presentation/http/responses',
        });
      }
    }
  }

  const legacyServicesDirectory = join(moduleRoot, 'application', 'services');
  if (await pathExists(legacyServicesDirectory)) {
    violations.push({
      file: `src/modules/${moduleName}/application/services`,
      specifier: 'application/services',
      reason: 'service-centric application folders are forbidden; use commands/queries/ports',
    });
  }
}

for (const file of files) {
  const rel = toPosix(relative(ROOT, file));
  const source = await readFile(file, 'utf8');
  const imports = [...source.matchAll(importPattern)].map((match) => match[1]);

  const isSpec = rel.endsWith('.spec.ts');
  const isDomain = rel.includes('/domain/');
  const isApplication = rel.includes('/application/');
  const isPresentation = rel.includes('/presentation/');
  const moduleMatch = rel.match(/^src\/modules\/([^/]+)\//);
  const sourceModule = moduleMatch?.[1];

  if (
    isApplication &&
    !isSpec &&
    (rel.includes('/application/services/') || rel.endsWith('.service.ts'))
  ) {
    violations.push({
      file: rel,
      specifier: rel,
      reason: 'application use cases must be commands/queries, not *Service classes',
    });
  }

  if (isSpec) {
    continue;
  }

  for (const specifier of imports) {
    const crossModuleMatch = specifier.match(/^@\/modules\/([^/]+)(\/.*)$/);

    if (
      sourceModule &&
      crossModuleMatch &&
      crossModuleMatch[1] !== sourceModule
    ) {
      violations.push({
        file: rel,
        specifier,
        reason: 'modules must import another module through its public root contract',
      });
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
      violations.push({
        file: rel,
        specifier,
        reason: 'application must depend on ports, not infrastructure/Prisma',
      });
      continue;
    }

    if (
      isPresentation &&
      (isInfrastructureImport(specifier) || isGeneratedPrismaImport(specifier))
    ) {
      violations.push({
        file: rel,
        specifier,
        reason:
          'presentation must depend on application/domain contracts, not infrastructure/Prisma',
      });
    }
  }
}

if (violations.length > 0) {
  console.error('\nArchitecture boundary violations:');
  for (const violation of violations) {
    console.error(
      `  - ${violation.file}: ${violation.specifier} (${violation.reason})`,
    );
  }
  process.exitCode = 1;
} else {
  console.log(
    `Architecture boundaries OK (${moduleNames.length} modules, canonical folders enforced, 0 legacy exceptions).`,
  );
}

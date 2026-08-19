#!/usr/bin/env node

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const manifestPath = path.join(
  repositoryRoot,
  'backend/ops/production/production-v1.scope.json',
);

const modeArgument = process.argv.find((argument) => argument.startsWith('--mode='));
const mode = modeArgument?.slice('--mode='.length) ?? 'contract';

if (!['contract', 'release'].includes(mode)) {
  fail(`Unsupported mode "${mode}". Use --mode=contract or --mode=release.`);
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const errors = [];

validateManifest(manifest, errors);
await validateDeferredSourceGuards(manifest, errors);

if (mode === 'release') {
  const blockers = manifest.features.filter(
    (feature) => feature.decision === 'required' && feature.readiness !== 'ready',
  );

  for (const blocker of blockers) {
    errors.push(
      `Production blocker ${blocker.id}: ${blocker.blockingReason ?? 'readiness is not ready'}${
        blocker.nextPhase ? ` (next: ${blocker.nextPhase})` : ''
      }`,
    );
  }
}

if (errors.length > 0) {
  console.error(`Production V1 scope ${mode} check failed:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const required = manifest.features.filter((feature) => feature.decision === 'required');
const ready = required.filter((feature) => feature.readiness === 'ready');
const blocked = required.filter((feature) => feature.readiness !== 'ready');
const deferred = manifest.features.filter((feature) => feature.decision === 'deferred');

console.log(
  `Production V1 scope ${mode} check OK: ${ready.length}/${required.length} required ready, ${blocked.length} blocked, ${deferred.length} deferred and hidden.`,
);

function validateManifest(candidate, validationErrors) {
  if (candidate.schemaVersion !== 1) {
    validationErrors.push('schemaVersion must be 1.');
  }

  if (candidate.release !== 'production-v1') {
    validationErrors.push('release must be "production-v1".');
  }

  if (!Array.isArray(candidate.features) || candidate.features.length === 0) {
    validationErrors.push('features must be a non-empty array.');
    return;
  }

  const identifiers = new Set();

  for (const feature of candidate.features) {
    if (!isNonEmptyString(feature.id)) {
      validationErrors.push('Every feature requires a non-empty id.');
      continue;
    }

    if (identifiers.has(feature.id)) {
      validationErrors.push(`Duplicate feature id: ${feature.id}.`);
    }
    identifiers.add(feature.id);

    if (!['required', 'deferred'].includes(feature.decision)) {
      validationErrors.push(`${feature.id}: decision must be required or deferred.`);
      continue;
    }

    if (!isNonEmptyString(feature.owner)) {
      validationErrors.push(`${feature.id}: owner is required.`);
    }

    if (feature.decision === 'required') {
      if (!['ready', 'blocked'].includes(feature.readiness)) {
        validationErrors.push(`${feature.id}: required readiness must be ready or blocked.`);
      }

      if (feature.readiness === 'ready' && feature.productionExposure !== 'enabled') {
        validationErrors.push(`${feature.id}: ready required features must be enabled.`);
      }

      if (feature.readiness === 'blocked') {
        if (feature.productionExposure !== 'pending') {
          validationErrors.push(`${feature.id}: blocked required features must be pending.`);
        }
        if (!isNonEmptyString(feature.blockingReason)) {
          validationErrors.push(`${feature.id}: blocked required features need blockingReason.`);
        }
        if (!isNonEmptyString(feature.nextPhase)) {
          validationErrors.push(`${feature.id}: blocked required features need nextPhase.`);
        }
      }
    }

    if (feature.decision === 'deferred') {
      if (feature.readiness !== 'deferred') {
        validationErrors.push(`${feature.id}: deferred features must use readiness=deferred.`);
      }
      if (feature.productionExposure !== 'hidden') {
        validationErrors.push(`${feature.id}: deferred features must be hidden.`);
      }
      if (!isNonEmptyString(feature.nextPhase)) {
        validationErrors.push(`${feature.id}: deferred features need nextPhase.`);
      }
    }
  }

  if (!Array.isArray(candidate.sourceGuards)) {
    validationErrors.push('sourceGuards must be an array.');
    return;
  }

  for (const guard of candidate.sourceGuards) {
    if (!identifiers.has(guard.featureId)) {
      validationErrors.push(`Source guard references unknown feature: ${guard.featureId}.`);
    }
    if (!isNonEmptyString(guard.path)) {
      validationErrors.push(`Source guard for ${guard.featureId} requires path.`);
    }
    if (!Array.isArray(guard.forbidden) || guard.forbidden.length === 0) {
      validationErrors.push(`Source guard for ${guard.featureId} requires forbidden tokens.`);
    }
  }
}

async function validateDeferredSourceGuards(candidate, validationErrors) {
  if (!Array.isArray(candidate.features) || !Array.isArray(candidate.sourceGuards)) return;

  const featureById = new Map(candidate.features.map((feature) => [feature.id, feature]));

  for (const guard of candidate.sourceGuards) {
    const feature = featureById.get(guard.featureId);
    if (!feature || feature.decision !== 'deferred') continue;

    const targetPath = path.resolve(repositoryRoot, guard.path);
    if (!targetPath.startsWith(`${repositoryRoot}${path.sep}`) && targetPath !== repositoryRoot) {
      validationErrors.push(`${guard.featureId}: guard path escapes repository root.`);
      continue;
    }

    let files;
    try {
      files = await collectFiles(targetPath);
    } catch (error) {
      validationErrors.push(`${guard.featureId}: cannot inspect ${guard.path}: ${error.message}`);
      continue;
    }

    for (const file of files) {
      const content = await readFile(file, 'utf8');
      for (const token of guard.forbidden) {
        if (content.includes(token)) {
          validationErrors.push(
            `${guard.featureId}: deferred Production V1 exposure "${token}" found in ${path.relative(
              repositoryRoot,
              file,
            )}.`,
          );
        }
      }
    }
  }
}

async function collectFiles(targetPath) {
  const targetStat = await stat(targetPath);
  if (targetStat.isFile()) return [targetPath];
  if (!targetStat.isDirectory()) return [];

  const entries = await readdir(targetPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(targetPath, entry.name);
      if (entry.isDirectory()) return collectFiles(entryPath);
      return entry.isFile() ? [entryPath] : [];
    }),
  );

  return nested.flat();
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

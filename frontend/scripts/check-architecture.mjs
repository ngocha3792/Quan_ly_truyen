import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findBoundaryViolations } from './architecture-rules.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(workspaceRoot, 'src', 'app');

const debtBaseline = {
  inlineTemplates: 49,
  inlineStyles: 45,
  scopedInlineTemplates: 0,
  scopedInlineStyles: 0,

  /*
   * Phase 7 ratchet.
   *
   * Không nâng các số này chỉ để CI xanh.
   * Debt chỉ được giữ nguyên hoặc giảm.
   */
  excessLines: 2525,
  componentExcessLines: 1007,
  storeExcessLines: 613,

  filesAtLeast300Lines: 38,
  filesAtLeast500Lines: 6,
  filesAtLeast800Lines: 0,
};

const hardLineLimits = {
  component: 500,
  store: 600,
  stylesheet: 850,
  template: 550,
  typescript: 800,
};

const focusedTargetLineLimits = {
  component: 250,
  store: 300,
};

const targetLineLimits = {
  component: 300,
  stylesheet: 400,
  template: 300,
  typescript: 400,
};

const files = await collectSourceFiles(sourceRoot);
const sourceFiles = files.filter(
  (file) => /\.(?:ts|html|scss)$/.test(file) && !file.endsWith('.spec.ts'),
);
const records = await Promise.all(
  sourceFiles.map(async (file) => {
    const content = await readFile(file, 'utf8');
    return {
      file,
      content,
      lines: content.split(/\r?\n/).length,
    };
  }),
);
const components = records.filter(isComponent);
const boundaryViolations = findBoundaryViolations(records, {
  sourceRoot,

  pathAliases: [
    {
      pattern: '@app/*',
      target: 'src/app/*',
      baseUrl: workspaceRoot,
    },
    {
      pattern: '@core/*',
      target: 'src/app/core/*',
      baseUrl: workspaceRoot,
    },
    {
      pattern: '@shared/*',
      target: 'src/app/shared/*',
      baseUrl: workspaceRoot,
    },
    {
      pattern: '@features/*',
      target: 'src/app/features/*',
      baseUrl: workspaceRoot,
    },
  ],

  featureScopes: new Set(['public', 'account', 'admin', 'author-portal']),
});

const current = {
  inlineTemplates: components.filter(({ content }) => /^\s*template\s*:/m.test(content)).length,
  inlineStyles: components.filter(({ content }) => /^\s*styles?\s*:/m.test(content)).length,
  scopedInlineTemplates: components.filter(
    ({ file, content }) => isExternalAssetScope(file) && /^\s*template\s*:/m.test(content),
  ).length,
  scopedInlineStyles: components.filter(
    ({ file, content }) => isExternalAssetScope(file) && /^\s*styles?\s*:/m.test(content),
  ).length,
  filesAtLeast200Lines: records.filter(({ lines }) => lines >= 200).length,
  filesAtLeast300Lines: records.filter(({ lines }) => lines >= 300).length,
  filesAtLeast500Lines: records.filter(({ lines }) => lines >= 500).length,
  filesAtLeast800Lines: records.filter(({ lines }) => lines >= 800).length,
  excessLines: records.reduce(
    (total, record) => total + Math.max(0, record.lines - targetLineLimitFor(record)),
    0,
  ),
  componentExcessLines: components.reduce(
    (total, record) => total + Math.max(0, record.lines - focusedTargetLineLimits.component),
    0,
  ),
  storeExcessLines: records
    .filter(isStore)
    .reduce(
      (total, record) => total + Math.max(0, record.lines - focusedTargetLineLimits.store),
      0,
    ),
};

const errors = [];

for (const [metric, baseline] of Object.entries(debtBaseline)) {
  if (current[metric] > baseline) {
    errors.push(`${metric} increased from ${baseline} to ${current[metric]}`);
  }
}

for (const record of records) {
  const limit = lineLimitFor(record);
  if (record.lines > limit) {
    errors.push(`${relativePath(record.file)} has ${record.lines} lines; hard limit is ${limit}`);
  }
}

for (const violation of boundaryViolations) {
  errors.push(`${relativePath(violation.file)}:${violation.line} ${violation.message}`);
}

const forbiddenAuthRuntimeLiterals = [
  'minimumLength: 8',
  'maximumLength: 72',
  'tokenExpiresInMinutes: 15',
  'Validators.minLength(8)',
  'Validators.maxLength(72)',
  'minlength="8"',
  'maxlength="72"',
];

for (const record of records) {
  if (!relativePath(record.file).startsWith('src/app/')) {
    continue;
  }

  for (const literal of forbiddenAuthRuntimeLiterals) {
    if (record.content.includes(literal)) {
      errors.push(
        `${relativePath(record.file)} hardcodes backend-owned auth policy literal ${JSON.stringify(literal)}`,
      );
    }
  }
}

console.log(
  [
    `Architecture debt: ${current.inlineTemplates} inline templates, ${current.inlineStyles} inline styles`,
    `External-asset scope debt: ${current.scopedInlineTemplates} inline templates, ${current.scopedInlineStyles} inline styles`,
    `Focused budgets: ${current.componentExcessLines} component excess lines, ${current.storeExcessLines} store excess lines`,
    `Large files: ${current.filesAtLeast300Lines} >=300, ${current.filesAtLeast500Lines} >=500, ${current.filesAtLeast800Lines} >=800 lines`,
    `Line-budget debt: ${current.excessLines} excess lines`,
    `Feature boundary violations: ${boundaryViolations.length}`,
  ].join('\n'),
);

if (errors.length > 0) {
  console.error('\nArchitecture guard failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? collectSourceFiles(entryPath) : [entryPath];
    }),
  );
  return nested.flat();
}

function lineLimitFor(record) {
  if (isStore(record)) return hardLineLimits.store;
  if (isComponent(record)) return hardLineLimits.component;
  if (record.file.endsWith('.scss')) return hardLineLimits.stylesheet;
  if (record.file.endsWith('.html')) return hardLineLimits.template;
  return hardLineLimits.typescript;
}

function targetLineLimitFor(record) {
  if (isComponent(record)) return targetLineLimits.component;
  if (record.file.endsWith('.scss')) return targetLineLimits.stylesheet;
  if (record.file.endsWith('.html')) return targetLineLimits.template;
  return targetLineLimits.typescript;
}

function isComponent(record) {
  return record.file.endsWith('.ts') && /@Component\s*\(/.test(record.content);
}

function isStore(record) {
  return record.file.endsWith('.store.ts');
}

function isExternalAssetScope(file) {
  const relative = path.relative(sourceRoot, file).split(path.sep).join('/');
  return (
    relative.startsWith('shared/') ||
    relative.startsWith('layout/') ||
    relative.startsWith('features/public/')
  );
}

function relativePath(file) {
  return path.relative(workspaceRoot, file).replaceAll(path.sep, '/');
}

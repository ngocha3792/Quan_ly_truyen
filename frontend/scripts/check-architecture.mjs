import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(workspaceRoot, 'src', 'app');

const debtBaseline = {
  inlineTemplates: 119,
  inlineStyles: 109,
  excessLines: 5_970,
};

const hardLineLimits = {
  component: 1_100,
  stylesheet: 850,
  template: 550,
  typescript: 800,
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

const current = {
  inlineTemplates: components.filter(({ content }) => /^\s*template\s*:/m.test(content)).length,
  inlineStyles: components.filter(({ content }) => /^\s*styles?\s*:/m.test(content)).length,
  filesAtLeast200Lines: records.filter(({ lines }) => lines >= 200).length,
  filesAtLeast300Lines: records.filter(({ lines }) => lines >= 300).length,
  filesAtLeast500Lines: records.filter(({ lines }) => lines >= 500).length,
  filesAtLeast800Lines: records.filter(({ lines }) => lines >= 800).length,
  excessLines: records.reduce(
    (total, record) => total + Math.max(0, record.lines - targetLineLimitFor(record)),
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

console.log(
  [
    `Architecture debt: ${current.inlineTemplates} inline templates, ${current.inlineStyles} inline styles`,
    `Large files: ${current.filesAtLeast300Lines} >=300, ${current.filesAtLeast500Lines} >=500, ${current.filesAtLeast800Lines} >=800 lines`,
    `Line-budget debt: ${current.excessLines} excess lines`,
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

function relativePath(file) {
  return path.relative(workspaceRoot, file).replaceAll(path.sep, '/');
}

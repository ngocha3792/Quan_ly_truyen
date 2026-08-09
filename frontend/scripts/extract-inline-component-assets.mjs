import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import ts from 'typescript';

const writeChanges = process.argv.includes('--write');
const requestedRoots = process.argv.slice(2).filter((argument) => argument !== '--write');
const roots = requestedRoots.length > 0 ? requestedRoots : ['src/app'];
const files = (
  await Promise.all(roots.map((root) => collectTypeScriptFiles(path.resolve(root))))
).flat();
const results = [];

for (const file of files) {
  const result = await extractComponentAssets(file, writeChanges);
  if (result) results.push(result);
}

for (const result of results) {
  console.log(
    `${writeChanges ? 'extracted' : 'would extract'} ${path.relative(process.cwd(), result)}`,
  );
}

console.log(`${writeChanges ? 'Extracted' : 'Found'} ${results.length} inline component(s).`);

async function collectTypeScriptFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) return collectTypeScriptFiles(entryPath);
      return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

async function extractComponentAssets(file, write) {
  const source = await readFile(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const metadata = findComponentMetadata(sourceFile);
  if (!metadata) return null;

  const templateProperty = findProperty(metadata, 'template');
  const stylesProperty = findProperty(metadata, 'styles');
  if (!templateProperty && !stylesProperty) return null;

  const basename = path.basename(file, '.ts');
  const directory = path.dirname(file);
  const replacements = [];
  const assets = [];

  if (templateProperty) {
    const template = readStaticTemplate(templateProperty.initializer, source, file, 'template');
    const templateFile = path.join(directory, `${basename}.html`);
    replacements.push({
      start: templateProperty.getStart(sourceFile),
      end: templateProperty.getEnd(),
      value: `templateUrl: './${basename}.html'`,
    });
    assets.push({ file: templateFile, content: normalizeAsset(template) });
  }

  if (stylesProperty) {
    const styles = ts.isArrayLiteralExpression(stylesProperty.initializer)
      ? stylesProperty.initializer.elements.map((element) =>
          readStaticTemplate(element, source, file, 'style'),
        )
      : [readStaticTemplate(stylesProperty.initializer, source, file, 'style')];
    const styleFile = path.join(directory, `${basename}.scss`);
    replacements.push({
      start: stylesProperty.getStart(sourceFile),
      end: stylesProperty.getEnd(),
      value: `styleUrl: './${basename}.scss'`,
    });
    assets.push({ file: styleFile, content: normalizeAsset(styles.join('\n\n')) });
  }

  if (write) {
    for (const asset of assets) {
      await writeFile(asset.file, asset.content, { encoding: 'utf8', flag: 'wx' });
    }

    const transformed = replacements
      .sort((left, right) => right.start - left.start)
      .reduce(
        (content, replacement) =>
          content.slice(0, replacement.start) + replacement.value + content.slice(replacement.end),
        source,
      );
    await writeFile(file, transformed, 'utf8');
  }

  return file;
}

function findComponentMetadata(sourceFile) {
  let metadata;

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Component' &&
      node.arguments.length === 1 &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      metadata = node.arguments[0];
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return metadata;
}

function findProperty(metadata, name) {
  return metadata.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) &&
      ((ts.isIdentifier(property.name) && property.name.text === name) ||
        (ts.isStringLiteral(property.name) && property.name.text === name)),
  );
}

function readStaticTemplate(initializer, source, file, kind) {
  if (!ts.isNoSubstitutionTemplateLiteral(initializer)) {
    throw new Error(`${file}: ${kind} must be a static template literal`);
  }
  return source.slice(initializer.getStart() + 1, initializer.getEnd() - 1);
}

function normalizeAsset(content) {
  const withoutOuterNewlines = content.replace(/^\r?\n/, '').replace(/\s+$/, '');
  const lines = withoutOuterNewlines.split(/\r?\n/);
  const indentation = lines
    .filter((line) => line.trim())
    .reduce((minimum, line) => Math.min(minimum, line.match(/^\s*/)[0].length), Infinity);

  return `${lines
    .map((line) => (Number.isFinite(indentation) ? line.slice(indentation) : line))
    .join('\n')}\n`;
}

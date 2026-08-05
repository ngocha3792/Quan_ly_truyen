import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appRoot = path.join(root, 'src', 'app');
const violations = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function layer(file) {
  const rel = path.relative(appRoot, file).replaceAll('\\', '/');
  const parts = rel.split('/');
  if (parts[0] === 'features') return { kind: 'feature', name: parts[1] };
  return { kind: parts[0], name: parts[0] };
}

function resolveTarget(file, specifier) {
  if (!specifier.startsWith('.')) return null;
  return path.resolve(path.dirname(file), specifier);
}

for (const file of walk(appRoot).filter((item) => item.endsWith('.ts') && !item.endsWith('.spec.ts') && !item.includes('.bak'))) {
  const sourceLayer = layer(file);
  const source = fs.readFileSync(file, 'utf8');
  const imports = [...source.matchAll(/(?:import|export)\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g)].map((match) => match[1]);
  for (const specifier of imports) {
    const resolved = resolveTarget(file, specifier);
    if (!resolved || !resolved.startsWith(appRoot)) continue;
    const targetLayer = layer(resolved);
    let invalid = false;
    if (sourceLayer.kind === 'shared' && ['features', 'feature', 'domains', 'core', 'layouts'].includes(targetLayer.kind)) invalid = true;
    if (sourceLayer.kind === 'core' && ['feature', 'layouts'].includes(targetLayer.kind)) invalid = true;
    if (sourceLayer.kind === 'domains' && ['feature', 'layouts'].includes(targetLayer.kind)) invalid = true;
    if (sourceLayer.kind === 'layouts' && targetLayer.kind === 'feature') invalid = true;
    if (sourceLayer.kind === 'feature' && targetLayer.kind === 'feature' && sourceLayer.name !== targetLayer.name) invalid = true;
    if (invalid) violations.push(
      path.relative(root, file) + ' -> ' + specifier + ' (' + sourceLayer.kind + ':' + sourceLayer.name + ' -> ' + targetLayer.kind + ':' + targetLayer.name + ')',
    );
  }
}

if (violations.length) {
  console.error('Frontend boundary violations:');
  for (const violation of violations) console.error(' - ' + violation);
  process.exit(1);
}
console.log('Frontend boundaries: OK');

import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const browserRoot = resolve(projectRoot, 'dist', 'frontend', 'browser');
const workerSourcePath = resolve(projectRoot, 'public', 'sw.js');
const workerOutputPath = resolve(browserRoot, 'sw.js');

await assertDirectory(browserRoot);

const files = await collectFiles(browserRoot);
const shellFiles = files
  .filter((path) => isShellAsset(path))
  .sort((left, right) => left.localeCompare(right));
const assets = ['/index.html', '/', ...shellFiles.map(toPublicPath)];
const hash = createHash('sha256');
for (const path of shellFiles) {
  hash.update(toPublicPath(path));
  hash.update(await readFile(path));
}
const version = hash.digest('hex').slice(0, 20);

await writeFile(
  resolve(browserRoot, 'pwa-assets.json'),
  `${JSON.stringify({ version, assets }, null, 2)}\n`,
  'utf8',
);
const workerSource = await readFile(workerSourcePath, 'utf8');
if (!workerSource.includes('__TRUYENHUB_BUILD_VERSION__')) {
  throw new Error('Service Worker source is missing its build version token.');
}
await writeFile(
  workerOutputPath,
  workerSource.replaceAll('__TRUYENHUB_BUILD_VERSION__', version),
  'utf8',
);

console.log(`Generated PWA asset manifest ${version} with ${assets.length} explicit assets.`);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(path) : [path];
    }),
  );
  return nested.flat();
}

function isShellAsset(path) {
  const publicPath = toPublicPath(path);
  return (
    /^\/(?:main|polyfills|styles|chunk)-[^/]+\.(?:js|css)$/.test(publicPath) ||
    publicPath === '/manifest.webmanifest' ||
    /^\/icons\/icon-(?:192x192|512x512)\.png$/.test(publicPath)
  );
}

function toPublicPath(path) {
  return `/${relative(browserRoot, path).split(sep).join('/')}`;
}

async function assertDirectory(path) {
  if (!(await stat(path)).isDirectory()) throw new Error(`PWA browser output not found: ${path}`);
}

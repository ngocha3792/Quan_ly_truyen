import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const requiredNode = readFileSync(resolve(repositoryRoot, '.nvmrc'), 'utf8').trim();
const requiredNpm = '11.12.1';

function normalizeVersion(version) {
  return version.trim().replace(/^v/, '');
}

function readNpmVersion() {
  const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  try {
    return normalizeVersion(
      execFileSync(npmExecutable, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
  } catch {
    return null;
  }
}

const actualNode = normalizeVersion(process.version);
const actualNpm = readNpmVersion();
const errors = [];

if (actualNode !== requiredNode) {
  errors.push(`Node.js ${requiredNode} is required; found ${actualNode}.`);
}

if (actualNpm !== requiredNpm) {
  errors.push(
    actualNpm
      ? `npm ${requiredNpm} is required; found ${actualNpm}.`
      : `npm ${requiredNpm} is required; npm was not found on PATH.`,
  );
}

if (errors.length > 0) {
  console.error('Development environment check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  console.error('');
  console.error('Expected toolchain:');
  console.error(`- Node.js ${requiredNode} (see .nvmrc / .node-version)`);
  console.error(`- npm ${requiredNpm}`);
  console.error('');
  console.error('After selecting the required Node.js version, run:');
  console.error(`npm install --global npm@${requiredNpm}`);
  process.exit(1);
}

console.log(`Development environment OK: Node.js ${actualNode}, npm ${actualNpm}`);

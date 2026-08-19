import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const manifestPath = path.join(
  repoRoot,
  'backend/ops/production/api-contracts.production-v1.json',
);
const matrixPath = path.join(repoRoot, 'backend/ops/production/API_CONTRACT_MATRIX.md');
const writeMode = process.argv.includes('--write');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const errors = [];
const screenIds = new Set();
let contractCount = 0;

if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.screens)) {
  errors.push('Manifest phải có schemaVersion=1 và screens[].');
}

for (const screen of manifest.screens ?? []) {
  if (!screen.id || screenIds.has(screen.id)) {
    errors.push(`Screen id không hợp lệ hoặc bị trùng: ${String(screen.id)}`);
    continue;
  }
  screenIds.add(screen.id);

  if (!screen.title || !screen.frontendRoute || !Array.isArray(screen.contracts) || screen.contracts.length === 0) {
    errors.push(`Screen ${screen.id} phải có title, frontendRoute và ít nhất một contract.`);
    continue;
  }

  for (const contract of screen.contracts) {
    contractCount += 1;
    validateContract(screen.id, contract);
  }
}

const markdown = renderMatrix(manifest);
if (writeMode) {
  fs.writeFileSync(matrixPath, markdown);
} else if (!fs.existsSync(matrixPath)) {
  errors.push(`Thiếu generated matrix: ${relative(matrixPath)}. Chạy node scripts/verify-api-contracts.mjs --write`);
} else if (normalize(fs.readFileSync(matrixPath, 'utf8')) !== normalize(markdown)) {
  errors.push('API_CONTRACT_MATRIX.md bị drift khỏi manifest. Chạy node scripts/verify-api-contracts.mjs --write');
}

if (errors.length > 0) {
  console.error('Production V1 API contract check failed:\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Production V1 API contract matrix OK: ${screenIds.size} screens, ${contractCount} wired endpoint contracts, 0 declared frontend-only/backend-only contracts.`,
);

function validateContract(screenId, contract) {
  const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  if (!allowedMethods.has(contract.method) || typeof contract.path !== 'string' || !contract.path.startsWith('/')) {
    errors.push(`${screenId}: method/path không hợp lệ.`);
  }

  validateBinding(screenId, contract, 'backend', contract.backend);

  if (!Array.isArray(contract.frontend) || contract.frontend.length === 0) {
    errors.push(`${screenId} ${contract.method} ${contract.path}: phải có ít nhất một frontend consumer.`);
    return;
  }

  for (const binding of contract.frontend) {
    validateBinding(screenId, contract, 'frontend', binding);
  }
}

function validateBinding(screenId, contract, side, binding) {
  if (!binding || typeof binding.file !== 'string' || !Array.isArray(binding.tokens) || binding.tokens.length === 0) {
    errors.push(`${screenId} ${contract.method} ${contract.path}: ${side} binding không hợp lệ.`);
    return;
  }

  const absolutePath = path.join(repoRoot, binding.file);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`${screenId} ${contract.method} ${contract.path}: thiếu ${side} file ${binding.file}`);
    return;
  }

  const source = fs.readFileSync(absolutePath, 'utf8');
  for (const token of binding.tokens) {
    if (!source.includes(token)) {
      errors.push(
        `${screenId} ${contract.method} ${contract.path}: ${side} token ${JSON.stringify(token)} không còn trong ${binding.file}`,
      );
    }
  }
}

function renderMatrix(value) {
  const lines = [
    '# Production V1 API Contract Matrix',
    '',
    '> Generated from `api-contracts.production-v1.json`. Do not edit by hand.',
    '>',
    '> Scope: important Production V1 user-facing screens and their HTTP dependencies. Every declared contract is required to have both a backend controller binding and at least one frontend consumer binding. Operational, webhook, maintenance and intentionally backend-only integration endpoints are outside this screen matrix.',
    '',
    '| Screen | Frontend route/surface | FE ↔ BE contracts | Frontend consumer files |',
    '| --- | --- | --- | --- |',
  ];

  for (const screen of value.screens ?? []) {
    const endpoints = screen.contracts.map((item) => `\`${item.method} ${item.path}\``).join('<br>');
    const files = [
      ...new Set(
        screen.contracts.flatMap((item) => item.frontend.map((binding) => `\`${binding.file}\``)),
      ),
    ].join('<br>');
    lines.push(`| ${escapeTable(screen.title)} | ${escapeTable(screen.frontendRoute)} | ${endpoints} | ${files} |`);
  }

  lines.push(
    '',
    '## Enforcement',
    '',
    '- `node scripts/verify-api-contracts.mjs` verifies every declared backend/frontend binding and fails on matrix drift.',
    '- `node scripts/verify-api-contracts.mjs --write` regenerates this table after an intentional contract change.',
    '- A new Production V1 screen that performs HTTP I/O must add its important contracts to the manifest in the same change.',
    '- Backend-only operational/webhook/maintenance endpoints are not evidence of a missing UI; they are deliberately outside this screen-oriented contract.',
  );

  return `${lines.join('\n')}\n`;
}

function escapeTable(value) {
  return String(value).replaceAll('|', '\\|');
}

function normalize(value) {
  return value.replaceAll('\r\n', '\n').trimEnd();
}

function relative(value) {
  return path.relative(repoRoot, value).replaceAll(path.sep, '/');
}

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

let cachedBackendDirectory: string | undefined;

export function runBackendScript(script: string): void {
  const cwd = resolveBackendDirectory();
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  const result = spawnSync(npmCommand, ['run', script], {
    cwd,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Backend script "${script}" thất bại với exit code ${result.status ?? 'unknown'}.`,
    );
  }
}

function resolveBackendDirectory(): string {
  if (cachedBackendDirectory) {
    return cachedBackendDirectory;
  }

  const candidates = [
    path.resolve(process.cwd(), '../backend'),
    path.resolve(process.cwd(), 'backend'),
  ];

  const backendDirectory = candidates.find((candidate) =>
    existsSync(path.join(candidate, 'package.json')),
  );

  if (!backendDirectory) {
    throw new Error(
      ['Không tìm thấy thư mục backend.', 'Playwright cần backend để chuẩn bị dữ liệu E2E.'].join(
        ' ',
      ),
    );
  }

  cachedBackendDirectory = backendDirectory;

  return backendDirectory;
}

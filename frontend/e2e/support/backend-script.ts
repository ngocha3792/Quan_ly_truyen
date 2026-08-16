import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

let cachedBackendDirectory: string | undefined;

export function runBackendScript(script: string, cwd = resolveBackendDirectory()): void {
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'cmd.exe' : 'npm';
  const args = isWindows ? ['/d', '/s', '/c', 'npm', 'run', script] : ['run', script];

  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Backend script "${script}" failed with exit code ${result.status}`);
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

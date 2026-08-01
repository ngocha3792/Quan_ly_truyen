import { config as loadDotenvFile } from 'dotenv';

import { resolveEnvFilePaths } from '@/config/environment-files';

let loaded = false;

export function loadEnvironmentFiles(): void {
  if (loaded) return;
  loaded = true;

  if (process.env.NODE_ENV === 'production') return;

  for (const path of resolveEnvFilePaths()) {
    loadDotenvFile({ path, override: false, quiet: true });
  }
}

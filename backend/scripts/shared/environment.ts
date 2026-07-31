import 'dotenv/config';

import { ScriptError, ScriptExitCode } from './script-error';

export function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ScriptError(
      `Environment variable ${name} is required`,
      ScriptExitCode.INVALID_ARGUMENT,
    );
  }

  return value;
}

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function assertNotProduction(operation: string): void {
  if (isProductionEnvironment()) {
    throw new ScriptError(
      `${operation} is not allowed when NODE_ENV=production`,
      ScriptExitCode.SAFETY_GUARD,
    );
  }
}

export function parseDatabaseTarget(databaseUrl: string): {
  host: string;
  port: string;
  database: string;
} {
  let url: URL;

  try {
    url = new URL(databaseUrl);
  } catch {
    throw new ScriptError(
      'DATABASE_URL is not a valid URL',
      ScriptExitCode.INVALID_ARGUMENT,
    );
  }

  return {
    host: url.hostname,
    port: url.port || '5432',
    database: url.pathname.replace(/^\//, '') || 'unknown',
  };
}

export function isLikelyLocalDatabase(databaseUrl: string): boolean {
  const { host } = parseDatabaseTarget(databaseUrl);

  return ['localhost', '127.0.0.1', '::1', 'postgres', 'database'].includes(
    host,
  );
}

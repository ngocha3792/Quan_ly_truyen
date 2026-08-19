import { AppRuntimeConfig } from './app-config.token';

export interface ParsedAuthClientConfig {
  readonly csrf: AppRuntimeConfig['csrf'];
  readonly passwordPolicy: AppRuntimeConfig['passwordPolicy'];
  readonly passwordReset: AppRuntimeConfig['passwordReset'];
}

export function parseAuthClientConfigResponse(value: unknown): ParsedAuthClientConfig {
  if (!isRecord(value) || value['success'] !== true) {
    throw new Error('Runtime auth config không đúng response envelope.');
  }

  const data = value['data'];
  if (!isRecord(data)) {
    throw new Error('Runtime auth config thiếu data.');
  }

  return {
    csrf: parseCsrfConfig(data['csrf']),
    passwordPolicy: parsePasswordPolicy(data['passwordPolicy']),
    passwordReset: parsePasswordReset(data['passwordReset']),
  };
}

function parseCsrfConfig(value: unknown): AppRuntimeConfig['csrf'] {
  if (!isRecord(value)) {
    throw new Error('Runtime auth config thiếu csrf config.');
  }

  const enabled = value['enabled'];
  const cookieName = value['cookieName'];
  const headerName = value['headerName'];

  if (typeof enabled !== 'boolean') {
    throw new Error('Runtime csrf.enabled không hợp lệ.');
  }
  if (!isNonEmptyString(cookieName)) {
    throw new Error('Runtime csrf.cookieName không hợp lệ.');
  }
  if (!isNonEmptyString(headerName)) {
    throw new Error('Runtime csrf.headerName không hợp lệ.');
  }

  return { enabled, cookieName, headerName };
}

function parsePasswordPolicy(value: unknown): AppRuntimeConfig['passwordPolicy'] {
  if (!isRecord(value)) {
    throw new Error('Runtime auth config thiếu passwordPolicy.');
  }

  const minimumLength = readPositiveInteger(value, 'minimumLength');
  const maximumLength = readPositiveInteger(value, 'maximumLength');
  const maximumBytes = readPositiveInteger(value, 'maximumBytes');

  if (maximumLength < minimumLength) {
    throw new Error('Runtime passwordPolicy length range không hợp lệ.');
  }

  return {
    minimumLength,
    maximumLength,
    maximumBytes,
    requireLowercase: readBoolean(value, 'requireLowercase'),
    requireUppercase: readBoolean(value, 'requireUppercase'),
    requireNumber: readBoolean(value, 'requireNumber'),
    requireSymbol: readBoolean(value, 'requireSymbol'),
  };
}

function parsePasswordReset(value: unknown): AppRuntimeConfig['passwordReset'] {
  if (!isRecord(value)) {
    throw new Error('Runtime auth config thiếu passwordReset.');
  }

  return {
    tokenExpiresInMinutes: readPositiveInteger(value, 'tokenExpiresInMinutes'),
  };
}

function readPositiveInteger(value: Record<string, unknown>, key: string): number {
  const candidate = value[key];
  if (!Number.isSafeInteger(candidate) || (candidate as number) <= 0) {
    throw new Error(`Runtime auth config ${key} không hợp lệ.`);
  }
  return candidate as number;
}

function readBoolean(value: Record<string, unknown>, key: string): boolean {
  const candidate = value[key];
  if (typeof candidate !== 'boolean') {
    throw new Error(`Runtime auth config ${key} không hợp lệ.`);
  }
  return candidate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

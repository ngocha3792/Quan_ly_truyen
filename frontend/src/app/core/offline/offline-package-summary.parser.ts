import type { OfflinePackageStatus, OfflinePackageSummary } from './offline.models';

const STATUSES: readonly OfflinePackageStatus[] = ['PREPARING', 'READY', 'EXPIRED', 'REVOKED'];

export function parseOfflinePackageSummaries(value: unknown): readonly OfflinePackageSummary[] {
  if (!Array.isArray(value)) throw invalid('danh sách package');
  return value.map((item, index) => parseSummary(item, `packages[${index}]`));
}

function parseSummary(value: unknown, path: string): OfflinePackageSummary {
  const record = readRecord(value, path);
  return {
    id: readString(record, 'id', path, false),
    deviceId: readNullableString(record, 'deviceId', path),
    name: readString(record, 'name', path, false),
    description: readNullableString(record, 'description', path),
    status: readStatus(record, path),
    totalSizeBytes: readBytes(record, path),
    chapterCount: readInteger(record, 'chapterCount', path),
    licenseExpiresAt: readDate(record, 'licenseExpiresAt', path),
    lastAccessedAt: readDate(record, 'lastAccessedAt', path),
    autoDeleteAt: readDate(record, 'autoDeleteAt', path),
    revokedAt: readNullableDate(record, 'revokedAt', path),
    revokedReason: readNullableString(record, 'revokedReason', path),
    createdAt: readDate(record, 'createdAt', path),
    updatedAt: readDate(record, 'updatedAt', path),
  };
}

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw invalid(path);
  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  allowEmpty: boolean,
): string {
  const value = record[key];
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) throw invalid(`${path}.${key}`);
  return value;
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
  path: string,
): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  return readString(record, key, path, true);
}

function readStatus(record: Record<string, unknown>, path: string): OfflinePackageStatus {
  const value = readString(record, 'status', path, false);
  if (!STATUSES.includes(value as OfflinePackageStatus)) throw invalid(`${path}.status`);
  return value as OfflinePackageStatus;
}

function readBytes(record: Record<string, unknown>, path: string): string {
  const value = readString(record, 'totalSizeBytes', path, false);
  if (!/^\d+$/.test(value)) throw invalid(`${path}.totalSizeBytes`);
  return value;
}

function readInteger(record: Record<string, unknown>, key: string, path: string): number {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw invalid(`${path}.${key}`);
  return value as number;
}

function readDate(record: Record<string, unknown>, key: string, path: string): string {
  const value = readString(record, key, path, false);
  if (!Number.isFinite(Date.parse(value))) throw invalid(`${path}.${key}`);
  return value;
}

function readNullableDate(
  record: Record<string, unknown>,
  key: string,
  path: string,
): string | null {
  const value = readNullableString(record, key, path);
  if (value !== null && !Number.isFinite(Date.parse(value))) throw invalid(`${path}.${key}`);
  return value;
}

function invalid(path: string): Error {
  return new Error(`Offline package summary: ${path} không hợp lệ.`);
}

import { extname } from 'node:path';

export function getFileExtension(filename: string): string {
  return extname(filename).toLowerCase();
}

export function sanitizeFilename(filename: string): string {
  const normalized = filename
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.replace(/^\.+/, '').slice(0, 255) || 'file';
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new RangeError('bytes phải là số không âm');
  }

  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1_024)),
    units.length - 1,
  );
  const value = bytes / 1_024 ** index;

  return `${value.toFixed(decimals)} ${units[index]}`;
}

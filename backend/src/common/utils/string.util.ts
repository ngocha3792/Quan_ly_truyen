export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function truncate(
  value: string,
  maxLength: number,
  suffix = '…',
): string {
  if (!Number.isInteger(maxLength) || maxLength < 0) {
    throw new RangeError('maxLength phải là số nguyên không âm');
  }

  if (value.length <= maxLength) {
    return value;
  }

  if (suffix.length >= maxLength) {
    return suffix.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - suffix.length)}${suffix}`;
}

export function capitalizeFirst(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toLocaleUpperCase('vi-VN') + value.slice(1);
}

export function maskEmail(email: string): string {
  const separatorIndex = email.lastIndexOf('@');

  if (separatorIndex <= 0) {
    return '***';
  }

  const localPart = email.slice(0, separatorIndex);
  const domain = email.slice(separatorIndex + 1);
  const visibleLength = Math.min(2, localPart.length);

  return `${localPart.slice(0, visibleLength)}***@${domain}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

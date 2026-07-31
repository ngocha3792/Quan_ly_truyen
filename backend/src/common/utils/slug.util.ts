import { escapeRegExp } from './string.util';

export interface SlugifyOptions {
  separator?: string;
  lowercase?: boolean;
  maxLength?: number;
}

const VIETNAMESE_D_PATTERN = /[đĐ]/g;
const COMBINING_MARKS_PATTERN = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC_PATTERN = /[^a-zA-Z0-9]+/g;

export function removeVietnameseDiacritics(value: string): string {
  return value
    .replace(VIETNAMESE_D_PATTERN, (character) =>
      character === 'đ' ? 'd' : 'D',
    )
    .normalize('NFD')
    .replace(COMBINING_MARKS_PATTERN, '');
}

export function slugify(
  value: string,
  options: SlugifyOptions = {},
): string {
  const separator = options.separator ?? '-';
  const lowercase = options.lowercase ?? true;
  const maxLength = options.maxLength ?? 200;

  if (!separator || /[a-zA-Z0-9]/.test(separator)) {
    throw new TypeError('Ký tự phân cách slug không hợp lệ');
  }

  let slug = removeVietnameseDiacritics(value.trim())
    .replace(NON_ALPHANUMERIC_PATTERN, separator)
    .replace(new RegExp(`${escapeRegExp(separator)}+`, 'g'), separator)
    .replace(new RegExp(`^${escapeRegExp(separator)}|${escapeRegExp(separator)}$`, 'g'), '');

  if (lowercase) {
    slug = slug.toLowerCase();
  }

  if (slug.length > maxLength) {
    slug = slug.slice(0, maxLength);
    slug = slug.replace(new RegExp(`${escapeRegExp(separator)}+$`), '');
  }

  return slug;
}

export function createUniqueSlug(baseSlug: string, suffix: string | number): string {
  const normalizedBase = slugify(baseSlug);
  const normalizedSuffix = slugify(String(suffix));

  return [normalizedBase, normalizedSuffix].filter(Boolean).join('-');
}

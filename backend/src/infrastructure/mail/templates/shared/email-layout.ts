import { EMAIL_STYLES } from './email-styles';
import { escapeHtml } from './escape-html';

export function emailLayout(title: string, content: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${EMAIL_STYLES}</style></head><body><div class="container"><div class="card"><h1>${escapeHtml(title)}</h1>${content}<p class="muted">Quan Ly Truyen</p></div></div></body></html>`;
}

export function safeLink(url: unknown, field: string): string {
  if (typeof url !== 'string') throw new Error(`${field} must be a string`);
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${field} must use http or https`);
  }
  return escapeHtml(parsed.toString());
}

export function requiredString(
  variables: Record<string, unknown>,
  field: string,
): string {
  const value = variables[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

export function requiredNumber(
  variables: Record<string, unknown>,
  field: string,
): number {
  const value = variables[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be a number`);
  }
  return value;
}

export function normalizeTaxonomyName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

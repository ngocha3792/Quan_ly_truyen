/**
 * The recognition host ships no Vietnamese model: "vi" falls back to a generic
 * latin dictionary that has no Vietnamese vowels and returns confident
 * nonsense, so it is deliberately absent here.
 */
export const OCR_LANGUAGES = ['ch', 'japan', 'korean', 'en'] as const;

export type OcrLanguage = (typeof OCR_LANGUAGES)[number];

export function isOcrLanguage(value: string): value is OcrLanguage {
  return (OCR_LANGUAGES as readonly string[]).includes(value);
}

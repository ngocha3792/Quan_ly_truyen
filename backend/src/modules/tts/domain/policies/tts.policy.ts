import { createHash } from 'node:crypto';

import { TtsInvalidInputException } from '../exceptions';

export const TTS_DEFAULT_MONTHLY_CHARACTER_LIMIT = 50_000;
export const TTS_MAX_SEGMENT_CHARACTERS = 5_000;

export function normalizeTtsLanguage(value: string): string {
  const language = value.trim();
  if (!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(language)) {
    throw new TtsInvalidInputException(
      'Mã ngôn ngữ TTS không hợp lệ',
      'language',
    );
  }
  return language;
}

export function normalizeTtsText(value: string, field: string): string {
  const text = value.trim();
  if (!text)
    throw new TtsInvalidInputException('Đoạn đọc không được để trống', field);
  if (text.length > TTS_MAX_SEGMENT_CHARACTERS) {
    throw new TtsInvalidInputException(
      `Mỗi đoạn đọc tối đa ${TTS_MAX_SEGMENT_CHARACTERS} ký tự`,
      field,
    );
  }
  return text;
}

export function ttsStyleHash(input: {
  readonly stability: number | null;
  readonly similarity: number | null;
  readonly style: number | null;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

import { sha256 } from '@/common/utils/crypto.util';

export interface ChapterTranslationHashInput {
  readonly title: string;
  readonly content: string;
  readonly targetLanguageCode: string;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value) ?? 'null';
}

export function computeChapterTranslationHash(
  input: ChapterTranslationHashInput,
): string {
  return sha256(
    stableSerialize({
      title: input.title,
      content: input.content,
      targetLanguageCode: input.targetLanguageCode,
    }),
  );
}

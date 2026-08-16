import { normalizeWhitespace } from '@/common/utils';

import { InvalidChapterFieldException } from '../exceptions';
import { ChapterDraftPolicy } from '../policies';

export class ChapterTitleValueObject {
  private constructor(readonly value: string) {}

  static create(raw: string): ChapterTitleValueObject {
    if (typeof raw !== 'string') {
      throw new InvalidChapterFieldException(
        'title',
        'Tiêu đề chương không hợp lệ',
      );
    }

    const value = normalizeWhitespace(raw);

    if (!value) {
      throw new InvalidChapterFieldException(
        'title',
        'Tiêu đề chương không được để trống',
      );
    }

    if (value.length > ChapterDraftPolicy.TITLE_MAX_LENGTH) {
      throw new InvalidChapterFieldException(
        'title',
        `Tiêu đề chương không được vượt quá ${ChapterDraftPolicy.TITLE_MAX_LENGTH} ký tự`,
      );
    }

    return new ChapterTitleValueObject(value);
  }
}

export class ChapterContentValueObject {
  private constructor(readonly value: string) {}

  static create(raw: string | null | undefined): ChapterContentValueObject {
    if (raw === null || raw === undefined) {
      return new ChapterContentValueObject('');
    }

    if (typeof raw !== 'string') {
      throw new InvalidChapterFieldException(
        'content',
        'Nội dung chương không hợp lệ',
      );
    }

    return new ChapterContentValueObject(raw.replace(/\r\n?/g, '\n'));
  }
}

export function countChapterWords(content: string): number {
  const tokens = content.trim().split(/\s+/u);

  if (tokens.length === 1 && tokens[0] === '') {
    return 0;
  }

  return tokens.filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

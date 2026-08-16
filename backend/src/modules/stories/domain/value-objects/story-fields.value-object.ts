import { normalizeWhitespace } from '@/common/utils';

import { InvalidStoryFieldException } from '../exceptions';
import { StoryDraftPolicy } from '../policies';

export class StoryTitleValueObject {
  private constructor(readonly value: string) {}

  static create(raw: string): StoryTitleValueObject {
    if (typeof raw !== 'string') {
      throw new InvalidStoryFieldException(
        'title',
        'Tiêu đề truyện không hợp lệ',
      );
    }

    const value = normalizeWhitespace(raw);

    if (!value) {
      throw new InvalidStoryFieldException(
        'title',
        'Tiêu đề truyện không được để trống',
      );
    }

    if (value.length > StoryDraftPolicy.TITLE_MAX_LENGTH) {
      throw new InvalidStoryFieldException(
        'title',
        `Tiêu đề truyện không được vượt quá ${StoryDraftPolicy.TITLE_MAX_LENGTH} ký tự`,
      );
    }

    return new StoryTitleValueObject(value);
  }
}

export class StorySynopsisValueObject {
  private constructor(readonly value: string) {}

  static create(raw: string | null | undefined): StorySynopsisValueObject {
    if (raw === null || raw === undefined) {
      return new StorySynopsisValueObject('');
    }

    if (typeof raw !== 'string') {
      throw new InvalidStoryFieldException(
        'synopsis',
        'Giới thiệu truyện không hợp lệ',
      );
    }

    const value = raw.trim();

    return new StorySynopsisValueObject(value);
  }
}

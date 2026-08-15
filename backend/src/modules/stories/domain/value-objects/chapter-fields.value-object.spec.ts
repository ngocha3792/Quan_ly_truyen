import { InvalidChapterFieldException } from '../exceptions';
import {
  ChapterContentValueObject,
  ChapterTitleValueObject,
  countChapterWords,
} from './chapter-fields.value-object';

describe('Chapter field value objects', () => {
  it('normalize whitespace của title', () => {
    expect(ChapterTitleValueObject.create('  Chương   Một  ').value).toBe(
      'Chương Một',
    );
  });

  it('không cho title rỗng', () => {
    expect(() => ChapterTitleValueObject.create('   ')).toThrow(
      InvalidChapterFieldException,
    );
  });

  it('normalize CRLF nhưng không phá whitespace nội dung', () => {
    expect(
      ChapterContentValueObject.create('Dòng 1\r\n  Dòng 2\rDòng 3').value,
    ).toBe('Dòng 1\n  Dòng 2\nDòng 3');
  });

  it('cho phép draft content rỗng', () => {
    expect(ChapterContentValueObject.create(undefined).value).toBe('');
    expect(ChapterContentValueObject.create(null).value).toBe('');
  });

  it('đếm token có chữ hoặc số và bỏ token chỉ có markdown symbol', () => {
    expect(countChapterWords('Xin chào **thế giới** --- 123')).toBe(5);
    expect(countChapterWords('   ')).toBe(0);
  });
});

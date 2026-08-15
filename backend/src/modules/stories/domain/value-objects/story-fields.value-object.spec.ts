import { InvalidStoryFieldException } from '../exceptions';

import {
  StorySynopsisValueObject,
  StoryTitleValueObject,
} from './story-fields.value-object';

describe('Story field value objects', () => {
  it('normalize whitespace của title', () => {
    expect(StoryTitleValueObject.create('  Truyện    Mới  ').value).toBe(
      'Truyện Mới',
    );
  });

  it('không cho title rỗng sau normalize', () => {
    expect(() => StoryTitleValueObject.create('   ')).toThrow(
      InvalidStoryFieldException,
    );
  });

  it('cho synopsis trống ở giai đoạn draft', () => {
    expect(StorySynopsisValueObject.create(undefined).value).toBe('');
    expect(StorySynopsisValueObject.create(null).value).toBe('');
  });

  it('trim synopsis nhưng giữ nguyên xuống dòng nội dung', () => {
    expect(
      StorySynopsisValueObject.create('  Dòng một\n\nDòng hai  ').value,
    ).toBe('Dòng một\n\nDòng hai');
  });
});

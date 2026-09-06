import { computeChapterTranslationHash } from './chapter-translation-hash.util';

describe('computeChapterTranslationHash', () => {
  it('trả về cùng hash bất kể thứ tự field trong object input', () => {
    const hashA = computeChapterTranslationHash({
      title: 'Chương 1',
      content: 'Nội dung chương 1',
      targetLanguageCode: 'en',
    });

    const hashB = computeChapterTranslationHash({
      targetLanguageCode: 'en',
      content: 'Nội dung chương 1',
      title: 'Chương 1',
    });

    expect(hashA).toBe(hashB);
  });

  it('trả về hash khác nhau khi nội dung khác nhau', () => {
    const hashA = computeChapterTranslationHash({
      title: 'Chương 1',
      content: 'Nội dung A',
      targetLanguageCode: 'en',
    });

    const hashB = computeChapterTranslationHash({
      title: 'Chương 1',
      content: 'Nội dung B',
      targetLanguageCode: 'en',
    });

    expect(hashA).not.toBe(hashB);
  });

  it('trả về hash khác nhau khi ngôn ngữ đích khác nhau', () => {
    const hashA = computeChapterTranslationHash({
      title: 'Chương 1',
      content: 'Nội dung',
      targetLanguageCode: 'en',
    });

    const hashB = computeChapterTranslationHash({
      title: 'Chương 1',
      content: 'Nội dung',
      targetLanguageCode: 'ja',
    });

    expect(hashA).not.toBe(hashB);
  });

  it('trả về chuỗi hex sha256 (64 ký tự)', () => {
    const hash = computeChapterTranslationHash({
      title: 'a',
      content: 'b',
      targetLanguageCode: 'en',
    });

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

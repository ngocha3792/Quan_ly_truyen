import {
  TTS_MAX_SEGMENT_CHARACTERS,
  normalizeTtsLanguage,
  normalizeTtsText,
  ttsStyleHash,
} from './tts.policy';

describe('TTS policy', () => {
  it('normalizes supported language tags and rejects malformed values', () => {
    expect(normalizeTtsLanguage(' vi-VN ')).toBe('vi-VN');
    expect(() => normalizeTtsLanguage('vi_vn')).toThrow(
      'Mã ngôn ngữ TTS không hợp lệ',
    );
  });

  it('enforces the provider segment limit', () => {
    expect(normalizeTtsText('  Xin chào  ', 'text')).toBe('Xin chào');
    expect(() =>
      normalizeTtsText('x'.repeat(TTS_MAX_SEGMENT_CHARACTERS + 1), 'text'),
    ).toThrow(`Mỗi đoạn đọc tối đa ${TTS_MAX_SEGMENT_CHARACTERS} ký tự`);
  });

  it('uses every voice style parameter in the stable cache hash', () => {
    const base = ttsStyleHash({ stability: 0.5, similarity: 0.7, style: null });
    expect(base).toHaveLength(64);
    expect(
      ttsStyleHash({ stability: 0.5, similarity: 0.7, style: 0.1 }),
    ).not.toBe(base);
  });
});

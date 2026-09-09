import { CommentPolicy } from './comment.policy';

describe('CommentPolicy', () => {
  it('blocks configured whole words and phrases after Unicode and whitespace normalization', () => {
    for (const text of ['BUY   NOW!', 'buy\u200B now', 'ＢＵＹ now']) {
      expect(() =>
        CommentPolicy.assertNotBlacklisted(text, ['buy now']),
      ).toThrow('Bình luận chứa nội dung không được phép.');
    }
    expect(() =>
      CommentPolicy.assertNotBlacklisted('classical literature', [
        'ass',
        '',
        '   ',
      ]),
    ).not.toThrow();
    expect(() =>
      CommentPolicy.assertNotBlacklisted('x.y is blocked', ['x.y']),
    ).toThrow();
    expect(() =>
      CommentPolicy.assertNotBlacklisted('xay is fine', ['x.y']),
    ).not.toThrow();
  });
  it('rejects whitespace-only content and keeps the existing 4000 character cap', () => {
    expect(() => CommentPolicy.validateBody('     ', 3)).toThrow();
    expect(() => CommentPolicy.validateBody('x'.repeat(4001), 3)).toThrow();
    expect(CommentPolicy.validateBody('x'.repeat(4000), 3)).toHaveLength(4000);
  });

  it('normalizes duplicate fingerprints without rewriting stored internal whitespace', () => {
    expect(CommentPolicy.validateBody('  Truyện   hay  ', 3)).toBe(
      'Truyện   hay',
    );
    expect(CommentPolicy.fingerprint('Truyện hay')).toBe(
      CommentPolicy.fingerprint('  TRUYỆN    HAY '),
    );
  });

  it('enforces the configurable link limit and OTHER report description rule', () => {
    expect(() =>
      CommentPolicy.validateBody(
        'a https://a.test b https://b.test c https://c.test d https://d.test',
        3,
      ),
    ).toThrow();
    expect(() =>
      CommentPolicy.normalizeReportDescription('OTHER', 'ngắn'),
    ).toThrow();
    expect(
      CommentPolicy.normalizeReportDescription(
        'OTHER',
        'Mô tả đủ dài cho lý do khác',
      ),
    ).toBe('Mô tả đủ dài cho lý do khác');
  });
});

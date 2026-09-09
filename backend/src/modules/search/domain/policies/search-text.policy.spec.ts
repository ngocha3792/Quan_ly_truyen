import {
  normalizeSearchText,
  searchPlainText,
  searchSnippet,
  validateSearchInput,
} from './search-text.policy';

describe('Vietnamese search policy', () => {
  it('normalizes composed/decomposed Vietnamese and đ consistently', () => {
    expect(normalizeSearchText('  Đấu  PHÁ Thương Khung ')).toBe(
      'dau pha thuong khung',
    );
    expect(normalizeSearchText('Tiếng Việt'.normalize('NFD'))).toBe(
      'tieng viet',
    );
  });
  it('produces plain snippets with bounded length', () => {
    expect(
      searchPlainText(
        '<script>alert(1)</script> **Tiên hiệp** [truyện](https://example.test)',
      ),
    ).toBe('alert(1) Tiên hiệp truyện');
    const snippet = searchSnippet(
      'abc '.repeat(100) + 'Đấu phá ' + ' xyz'.repeat(100),
      'dau',
    );
    expect(snippet).toContain('Đấu phá');
    expect(snippet.length).toBeLessThanOrEqual(242);
  });
  it('rejects inverted years before consulting adapters', () => {
    expect(() =>
      validateSearchInput({
        q: '',
        kind: 'story',
        sort: 'relevance',
        page: 1,
        pageSize: 20,
        yearFrom: 2026,
        yearTo: 2020,
      }),
    ).toThrow();
  });
});

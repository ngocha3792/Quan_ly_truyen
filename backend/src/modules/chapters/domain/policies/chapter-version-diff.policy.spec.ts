import { chapterVersionDiff } from './chapter-version-diff.policy';

describe('chapter version diff', () => {
  it('preserves whitespace, Vietnamese text and untrusted markup as text', () => {
    const before = 'Đoạn đầu\n<script>x</script>\nCuối\n';
    const after = 'Đoạn đầu\nDòng mới\nCuối\n';
    const diff = chapterVersionDiff(before, after);
    expect(diff.stats).toEqual({ added: 1, removed: 1, unchanged: 2 });
    expect(
      diff.changes
        .filter((c) => c.type !== 'added')
        .map((c) => c.value)
        .join(''),
    ).toBe(before);
    expect(
      diff.changes
        .filter((c) => c.type !== 'removed')
        .map((c) => c.value)
        .join(''),
    ).toBe(after);
  });
  it('handles empty and unchanged revisions', () => {
    expect(chapterVersionDiff('', '').stats).toEqual({
      added: 0,
      removed: 0,
      unchanged: 0,
    });
    expect(chapterVersionDiff('Một dòng', 'Một dòng').stats).toEqual({
      added: 0,
      removed: 0,
      unchanged: 1,
    });
    expect(chapterVersionDiff('', 'Một dòng').stats.added).toBe(1);
  });
});

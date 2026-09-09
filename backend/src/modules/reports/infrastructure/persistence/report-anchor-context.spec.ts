import { reportAnchorContext } from './report-anchor-context';

describe('reportAnchorContext', () => {
  it('exposes only server-derived snapshots, never historical client hints', () => {
    const anchor = {
      blockId: 'block',
      chapterVersion: 2,
      quote: 'Snapshot',
      status: 'ORPHANED',
      lastVerifiedVersion: 3,
    };
    expect(reportAnchorContext({ context: { anchor } })).toBeNull();
    expect(
      reportAnchorContext({
        context: { source: 'SERVER', chapterVersion: 4, anchor },
      }),
    ).toEqual({
      blockId: 'block',
      chapterVersion: 2,
      quote: 'Snapshot',
      status: 'ORPHANED',
      lastVerifiedVersion: 3,
      reportedChapterVersion: 4,
      rootCommentId: null,
    });
    expect(reportAnchorContext(null)).toBeNull();
  });
});

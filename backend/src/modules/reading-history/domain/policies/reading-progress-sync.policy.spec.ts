import { decideReadingProgressSync } from './reading-progress-sync.policy';

describe('decideReadingProgressSync', () => {
  const storyId = '11111111-1111-4111-8111-111111111111';

  it('accepts sequential events from two devices against the latest revision', () => {
    expect(
      decideReadingProgressSync({
        storyId,
        baseRevision: 0,
        actualRevision: 0,
        processedStoryId: null,
      }),
    ).toEqual({ kind: 'accept', nextRevision: 1 });
    expect(
      decideReadingProgressSync({
        storyId,
        baseRevision: 1,
        actualRevision: 1,
        processedStoryId: null,
      }),
    ).toEqual({ kind: 'accept', nextRevision: 2 });
  });

  it('acknowledges a replayed client event without incrementing revision', () => {
    expect(
      decideReadingProgressSync({
        storyId,
        baseRevision: 0,
        actualRevision: 3,
        processedStoryId: storyId,
      }),
    ).toEqual({ kind: 'duplicate' });
  });

  it.each([
    ['out-of-order event', 1, 3],
    ['stale tab', 2, 4],
  ])('rejects %s so it cannot overwrite a newer cursor', (_, base, actual) => {
    expect(
      decideReadingProgressSync({
        storyId,
        baseRevision: base,
        actualRevision: actual,
        processedStoryId: null,
      }),
    ).toEqual({
      kind: 'conflict',
      expectedRevision: base,
      actualRevision: actual,
    });
  });

  it('rejects reusing a client event id for another story', () => {
    expect(
      decideReadingProgressSync({
        storyId,
        baseRevision: 0,
        actualRevision: 0,
        processedStoryId: '22222222-2222-4222-8222-222222222222',
      }),
    ).toEqual({
      kind: 'conflict',
      expectedRevision: 0,
      actualRevision: 0,
    });
  });
});

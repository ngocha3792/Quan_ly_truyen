import { ReaderEngagementPolicy } from './reader-engagement.policy';

describe('ReaderEngagementPolicy', () => {
  it('accepts only integer ratings from 1 to 5', () => {
    expect(ReaderEngagementPolicy.isValidRating(1)).toBe(true);
    expect(ReaderEngagementPolicy.isValidRating(5)).toBe(true);
    expect(ReaderEngagementPolicy.isValidRating(0)).toBe(false);
    expect(ReaderEngagementPolicy.isValidRating(6)).toBe(false);
    expect(ReaderEngagementPolicy.isValidRating(3.5)).toBe(false);
  });

  it('normalizes comment whitespace and enforces the configured limit', () => {
    expect(ReaderEngagementPolicy.normalizeCommentBody('  nội dung  ')).toBe('nội dung');
    expect(ReaderEngagementPolicy.isValidCommentBody('   ')).toBe(false);
    expect(
      ReaderEngagementPolicy.isValidCommentBody(
        'a'.repeat(ReaderEngagementPolicy.COMMENT_MAX_LENGTH),
      ),
    ).toBe(true);
    expect(
      ReaderEngagementPolicy.isValidCommentBody(
        'a'.repeat(ReaderEngagementPolicy.COMMENT_MAX_LENGTH + 1),
      ),
    ).toBe(false);
  });
});

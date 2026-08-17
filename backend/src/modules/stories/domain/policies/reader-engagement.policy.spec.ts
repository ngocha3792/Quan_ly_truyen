import { ReaderEngagementPolicy } from './reader-engagement.policy';

describe('ReaderEngagementPolicy', () => {
  it('normalizes comment whitespace and enforces the configured limit', () => {
    expect(ReaderEngagementPolicy.normalizeCommentBody('  nội dung  ')).toBe(
      'nội dung',
    );
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

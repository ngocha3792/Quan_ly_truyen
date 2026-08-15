export class ReaderEngagementPolicy {
  static readonly RATING_MIN = 1;
  static readonly RATING_MAX = 5;
  static readonly COMMENT_MAX_LENGTH = 4000;

  static normalizeCommentBody(value: string): string {
    return value.trim();
  }

  static isValidCommentBody(value: string): boolean {
    const normalized = this.normalizeCommentBody(value);
    return normalized.length >= 1 && normalized.length <= this.COMMENT_MAX_LENGTH;
  }

  static isValidRating(score: number): boolean {
    return (
      Number.isInteger(score) &&
      score >= this.RATING_MIN &&
      score <= this.RATING_MAX
    );
  }
}

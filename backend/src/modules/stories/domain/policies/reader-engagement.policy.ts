export class ReaderEngagementPolicy {
  static readonly COMMENT_MAX_LENGTH = 4000;

  static normalizeCommentBody(value: string): string {
    return value.trim();
  }

  static isValidCommentBody(value: string): boolean {
    const normalized = this.normalizeCommentBody(value);
    return (
      normalized.length >= 1 && normalized.length <= this.COMMENT_MAX_LENGTH
    );
  }
}

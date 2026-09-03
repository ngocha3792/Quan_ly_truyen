export class ReadingGoalPolicy {
  static readonly MIN_TARGET_CHAPTERS = 1;
  static readonly MAX_TARGET_CHAPTERS = 100;

  static isValidTarget(targetChapters: number): boolean {
    return (
      Number.isInteger(targetChapters) &&
      targetChapters >= this.MIN_TARGET_CHAPTERS &&
      targetChapters <= this.MAX_TARGET_CHAPTERS
    );
  }
}

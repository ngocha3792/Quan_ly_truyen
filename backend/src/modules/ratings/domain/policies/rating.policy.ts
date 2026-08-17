export class RatingPolicy {
  static readonly MIN_SCORE = 1;
  static readonly MAX_SCORE = 5;

  static isValidScore(score: number): boolean {
    return (
      Number.isInteger(score) &&
      score >= this.MIN_SCORE &&
      score <= this.MAX_SCORE
    );
  }
}

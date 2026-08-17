import { RatingPolicy } from './rating.policy';

describe('RatingPolicy', () => {
  it('accepts integer scores from 1 to 5', () => {
    expect(RatingPolicy.isValidScore(1)).toBe(true);
    expect(RatingPolicy.isValidScore(5)).toBe(true);
    expect(RatingPolicy.isValidScore(0)).toBe(false);
    expect(RatingPolicy.isValidScore(6)).toBe(false);
    expect(RatingPolicy.isValidScore(3.5)).toBe(false);
  });
});

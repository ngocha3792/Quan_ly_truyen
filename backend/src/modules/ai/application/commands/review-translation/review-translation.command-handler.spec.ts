import { ReviewTranslationCommandHandler } from './review-translation.command-handler';
import type { ReviewTranslationInput } from '../../ports/translation-review.port';

describe('translation review decisions', () => {
  const persistence = { review: jest.fn() };
  const handler = new ReviewTranslationCommandHandler(persistence);
  it('requires notes for rejection and revision requests', () => {
    for (const decision of ['REJECT', 'REQUEST_REVISION'] as const) {
      expect(() =>
        handler.execute({
          userId: '11111111-1111-4111-8111-111111111111',
          decision,
          notes: ' ',
        } as ReviewTranslationInput),
      ).toThrow();
    }
    expect(persistence.review).not.toHaveBeenCalled();
  });
});

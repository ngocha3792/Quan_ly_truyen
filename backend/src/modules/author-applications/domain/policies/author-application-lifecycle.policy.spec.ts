import { AuthorApplicationStatus } from '../enums';

import { AuthorApplicationLifecyclePolicy } from './author-application-lifecycle.policy';

const completeApplication = {
  penName: 'Moon',
  fullName: 'Nguyen Van A',
  email: 'author@example.test',
  phone: '0900000000',
  primaryGenre: 'tien-hiep',
  experience: 'new',
  introduction: 'Introduction',
  firstWorkSynopsis: 'Synopsis',
  acceptedTerms: true,
};

describe('AuthorApplicationLifecyclePolicy', () => {
  it('owns draft and reopen transitions', () => {
    expect(
      AuthorApplicationLifecyclePolicy.decideDraftTransition(
        AuthorApplicationStatus.DRAFT,
      ),
    ).toBe('save');
    expect(
      AuthorApplicationLifecyclePolicy.decideDraftTransition(
        AuthorApplicationStatus.REJECTED,
      ),
    ).toBe('reopen_rejected');
    expect(
      AuthorApplicationLifecyclePolicy.decideDraftTransition(
        AuthorApplicationStatus.PENDING,
      ),
    ).toBe('pending');
    expect(
      AuthorApplicationLifecyclePolicy.decideDraftTransition(
        AuthorApplicationStatus.APPROVED,
      ),
    ).toBe('already_approved');
  });

  it('requires every submission field and accepted terms', () => {
    expect(
      AuthorApplicationLifecyclePolicy.decideSubmission(
        AuthorApplicationStatus.DRAFT,
        {
          ...completeApplication,
          phone: ' ',
          acceptedTerms: false,
        },
      ),
    ).toEqual({
      outcome: 'incomplete',
      missingFields: ['phone', 'acceptedTerms'],
    });

    expect(
      AuthorApplicationLifecyclePolicy.decideSubmission(
        AuthorApplicationStatus.REJECTED,
        completeApplication,
      ),
    ).toEqual({ outcome: 'submit' });
  });

  it('keeps pending submission idempotent and approved terminal', () => {
    expect(
      AuthorApplicationLifecyclePolicy.decideSubmission(
        AuthorApplicationStatus.PENDING,
        completeApplication,
      ),
    ).toEqual({ outcome: 'already_submitted' });
    expect(
      AuthorApplicationLifecyclePolicy.decideSubmission(
        AuthorApplicationStatus.APPROVED,
        completeApplication,
      ),
    ).toEqual({ outcome: 'already_approved' });
  });

  it('only permits a different reviewer to review a pending application', () => {
    expect(
      AuthorApplicationLifecyclePolicy.decideReview(
        AuthorApplicationStatus.PENDING,
        'user-a',
        'user-a',
      ),
    ).toBe('self_review');
    expect(
      AuthorApplicationLifecyclePolicy.decideReview(
        AuthorApplicationStatus.DRAFT,
        'user-a',
        'admin-b',
      ),
    ).toBe('not_pending');
    expect(
      AuthorApplicationLifecyclePolicy.decideReview(
        AuthorApplicationStatus.PENDING,
        'user-a',
        'admin-b',
      ),
    ).toBe('review');
  });
});

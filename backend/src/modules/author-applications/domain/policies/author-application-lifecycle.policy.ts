import { AuthorApplicationStatus } from '../enums';

export type AuthorDraftTransition =
  'save' | 'reopen_rejected' | 'pending' | 'already_approved';

export type AuthorSubmissionTransition =
  | { readonly outcome: 'submit' }
  | { readonly outcome: 'already_submitted' }
  | { readonly outcome: 'already_approved' }
  | {
      readonly outcome: 'incomplete';
      readonly missingFields: readonly string[];
    };

export type AuthorReviewTransition = 'review' | 'self_review' | 'not_pending';

export interface AuthorApplicationCompletionSnapshot {
  readonly penName: string | null;
  readonly fullName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly primaryGenre: string | null;
  readonly experience: string | null;
  readonly introduction: string | null;
  readonly firstWorkSynopsis: string | null;
  readonly acceptedTerms: boolean;
}

/** Pure lifecycle decisions. Persistence and locking remain infrastructure concerns. */
export class AuthorApplicationLifecyclePolicy {
  static decideDraftTransition(
    status: AuthorApplicationStatus,
  ): AuthorDraftTransition {
    switch (status) {
      case AuthorApplicationStatus.DRAFT:
        return 'save';
      case AuthorApplicationStatus.REJECTED:
        return 'reopen_rejected';
      case AuthorApplicationStatus.PENDING:
        return 'pending';
      case AuthorApplicationStatus.APPROVED:
        return 'already_approved';
    }
  }

  static decideSubmission(
    status: AuthorApplicationStatus,
    application: AuthorApplicationCompletionSnapshot,
  ): AuthorSubmissionTransition {
    if (status === AuthorApplicationStatus.APPROVED) {
      return { outcome: 'already_approved' };
    }

    if (status === AuthorApplicationStatus.PENDING) {
      return { outcome: 'already_submitted' };
    }

    const missingFields = this.findMissingFields(application);

    return missingFields.length > 0
      ? { outcome: 'incomplete', missingFields }
      : { outcome: 'submit' };
  }

  static decideReview(
    status: AuthorApplicationStatus,
    applicantUserId: string,
    reviewerUserId: string,
  ): AuthorReviewTransition {
    if (applicantUserId === reviewerUserId) {
      return 'self_review';
    }

    return status === AuthorApplicationStatus.PENDING
      ? 'review'
      : 'not_pending';
  }

  static findMissingFields(
    application: AuthorApplicationCompletionSnapshot,
  ): readonly string[] {
    const required: ReadonlyArray<
      readonly [keyof AuthorApplicationCompletionSnapshot, string | null]
    > = [
      ['penName', application.penName],
      ['fullName', application.fullName],
      ['email', application.email],
      ['phone', application.phone],
      ['primaryGenre', application.primaryGenre],
      ['experience', application.experience],
      ['introduction', application.introduction],
      ['firstWorkSynopsis', application.firstWorkSynopsis],
    ];

    const missing = required
      .filter(([, value]) => !value?.trim())
      .map(([field]) => field);

    return application.acceptedTerms ? missing : [...missing, 'acceptedTerms'];
  }
}

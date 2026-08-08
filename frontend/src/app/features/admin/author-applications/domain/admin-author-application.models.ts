export type AdminAuthorApplicationStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';

export type AdminAuthorApplicationStatusFilter =
  | 'ALL'
  | AdminAuthorApplicationStatus;

export interface AdminAuthorApplicationSample {
  readonly id: string;

  readonly fileName: string | null;

  readonly mimeType: string | null;

  readonly sizeBytes: string | null;

  readonly url: string | null;
}

export interface AdminAuthorApplicationRecord {
  readonly applicationId: string;

  readonly userId: string;

  readonly status: AdminAuthorApplicationStatus;

  readonly penName: string | null;

  readonly fullName: string | null;

  readonly email: string | null;

  readonly phone: string | null;

  readonly portfolioUrl: string | null;

  readonly primaryGenre: string | null;

  readonly experience: string | null;

  readonly introduction: string | null;

  readonly firstWorkSynopsis: string | null;

  readonly acceptedTerms: boolean;

  readonly sample: AdminAuthorApplicationSample | null;

  readonly submittedAt: string | null;

  readonly reviewedAt: string | null;

  readonly reviewedById: string | null;

  readonly rejectionReason: string | null;

  readonly createdAt: string;

  readonly updatedAt: string;
}

export interface AdminAuthorApplicationListResponse {
  readonly total: number;

  readonly applications:
    readonly AdminAuthorApplicationRecord[];
}

export interface AdminAuthorApplicationListQuery {
  readonly status?: AdminAuthorApplicationStatus;

  readonly keyword?: string;

  readonly offset: number;

  readonly limit: number;
}

export const AUTHOR_REJECTION_REASON_MIN_LENGTH = 10;

export const AUTHOR_REJECTION_REASON_MAX_LENGTH = 1000;

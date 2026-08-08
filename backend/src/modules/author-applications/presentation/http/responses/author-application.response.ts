import type {
  AuthorApplicationListResultDto,
  AuthorApplicationResultDto,
} from '../../../application';

export interface AuthorApplicationResponse {
  readonly applicationId: string;

  readonly userId: string;

  readonly status: string;

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

  readonly sample: {
    readonly id: string;

    readonly fileName: string | null;

    readonly mimeType: string | null;

    readonly sizeBytes: string | null;

    readonly url: string | null;
  } | null;

  readonly submittedAt: string | null;

  readonly reviewedAt: string | null;

  readonly reviewedById: string | null;

  readonly rejectionReason: string | null;

  readonly createdAt: string;

  readonly updatedAt: string;
}

export interface AuthorApplicationListResponse {
  readonly total: number;

  readonly applications: readonly AuthorApplicationResponse[];
}

export function toAuthorApplicationResponse(
  result: AuthorApplicationResultDto,
): AuthorApplicationResponse {
  return {
    applicationId: result.applicationId,

    userId: result.userId,

    status: result.status,

    penName: result.penName,

    fullName: result.fullName,

    email: result.email,

    phone: result.phone,

    portfolioUrl: result.portfolioUrl,

    primaryGenre: result.primaryGenre,

    experience: result.experience,

    introduction: result.introduction,

    firstWorkSynopsis: result.firstWorkSynopsis,

    acceptedTerms: result.acceptedTerms,

    sample: result.sample,

    submittedAt: result.submittedAt?.toISOString() ?? null,

    reviewedAt: result.reviewedAt?.toISOString() ?? null,

    reviewedById: result.reviewedById,

    rejectionReason: result.rejectionReason,

    createdAt: result.createdAt.toISOString(),

    updatedAt: result.updatedAt.toISOString(),
  };
}

export function toAuthorApplicationListResponse(
  result: AuthorApplicationListResultDto,
): AuthorApplicationListResponse {
  return {
    total: result.total,

    applications: result.applications.map(toAuthorApplicationResponse),
  };
}

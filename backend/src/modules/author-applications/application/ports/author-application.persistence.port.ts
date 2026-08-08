import type { AuthorApplicationStatus } from '../../domain';

export const AUTHOR_APPLICATION_PERSISTENCE_PORT = Symbol(
  'AUTHOR_APPLICATION_PERSISTENCE_PORT',
);

export interface AuthorApplicationSampleRecord {
  readonly id: string;

  readonly fileName: string | null;

  readonly mimeType: string | null;

  readonly sizeBytes: bigint | null;

  readonly url: string | null;
}

export interface AuthorApplicationRecord {
  readonly id: string;

  readonly userId: string;

  readonly status: AuthorApplicationStatus;

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

  readonly sample: AuthorApplicationSampleRecord | null;

  readonly submittedAt: Date | null;

  readonly reviewedAt: Date | null;

  readonly reviewedById: string | null;

  readonly rejectionReason: string | null;

  readonly createdAt: Date;

  readonly updatedAt: Date;
}

export interface AuthorApplicationAuditContext {
  readonly ipAddress?: string;

  readonly userAgent?: string;

  readonly requestId?: string;
}

export interface SaveAuthorApplicationDraftInput {
  readonly userId: string;

  readonly penName?: string | null;

  readonly fullName?: string | null;

  readonly email?: string | null;

  readonly phone?: string | null;

  readonly portfolioUrl?: string | null;

  readonly primaryGenre?: string | null;

  readonly experience?: string | null;

  readonly introduction?: string | null;

  readonly firstWorkSynopsis?: string | null;

  readonly acceptedTerms?: boolean;
}

export type SaveAuthorApplicationDraftResult =
  | {
      readonly status: 'saved';

      readonly application: AuthorApplicationRecord;
    }
  | {
      readonly status: 'pending';
    }
  | {
      readonly status: 'already_author';
    };

export interface SubmitAuthorApplicationInput {
  readonly userId: string;

  readonly applicationId: string;

  readonly sampleMediaId: string;

  readonly submittedAt: Date;

  readonly audit: AuthorApplicationAuditContext;
}

export type SubmitAuthorApplicationResult =
  | {
      readonly status: 'submitted';

      readonly application: AuthorApplicationRecord;
    }
  | {
      readonly status: 'not_found';
    }
  | {
      readonly status: 'already_author';
    }
  | {
      readonly status: 'incomplete';

      readonly missingFields: readonly string[];
    }
  | {
      readonly status: 'invalid_sample';
    }
  | {
      readonly status: 'pen_name_unavailable';

      readonly penName: string;
    };

export interface ListAuthorApplicationsInput {
  readonly status?: AuthorApplicationStatus;

  readonly offset: number;

  readonly limit: number;
}

export interface ListAuthorApplicationsResult {
  readonly total: number;

  readonly applications: readonly AuthorApplicationRecord[];
}

export interface ReviewAuthorApplicationInput {
  readonly applicationId: string;

  readonly reviewerId: string;

  readonly reviewedAt: Date;

  readonly audit: AuthorApplicationAuditContext;
}

export type ApproveAuthorApplicationResult =
  | {
      readonly status: 'approved';

      readonly application: AuthorApplicationRecord;

      readonly userId: string;
    }
  | {
      readonly status: 'not_found';
    }
  | {
      readonly status: 'not_pending';
    }
  | {
      readonly status: 'self_review';
    }
  | {
      readonly status: 'pen_name_unavailable';

      readonly penName: string;
    }
  | {
      readonly status: 'role_missing';
    }
  | {
      readonly status: 'already_author';
    };

export interface RejectAuthorApplicationInput extends ReviewAuthorApplicationInput {
  readonly reason: string;
}

export type RejectAuthorApplicationResult =
  | {
      readonly status: 'rejected';

      readonly application: AuthorApplicationRecord;
    }
  | {
      readonly status: 'not_found';
    }
  | {
      readonly status: 'not_pending';
    }
  | {
      readonly status: 'self_review';
    };

export interface AuthorApplicationPersistencePort {
  findByUserId(userId: string): Promise<AuthorApplicationRecord | null>;

  findById(applicationId: string): Promise<AuthorApplicationRecord | null>;

  saveDraft(
    input: SaveAuthorApplicationDraftInput,
  ): Promise<SaveAuthorApplicationDraftResult>;

  submit(
    input: SubmitAuthorApplicationInput,
  ): Promise<SubmitAuthorApplicationResult>;

  list(
    input: ListAuthorApplicationsInput,
  ): Promise<ListAuthorApplicationsResult>;

  approve(
    input: ReviewAuthorApplicationInput,
  ): Promise<ApproveAuthorApplicationResult>;

  reject(
    input: RejectAuthorApplicationInput,
  ): Promise<RejectAuthorApplicationResult>;
}

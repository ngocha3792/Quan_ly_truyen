export type AdminSubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';
export interface AdminStorySubmissionListItem {
  readonly submissionId: string;
  readonly status: AdminSubmissionStatus;
  readonly story: { readonly id: string; readonly title: string; readonly slug: string };
  readonly author: { readonly id: string; readonly displayName: string; readonly slug: string };
  readonly submittedAt: string;
  readonly reviewer: { readonly id: string; readonly displayName: string } | null;
  readonly reviewedAt: string | null;
  readonly rejectionReason: string | null;
  readonly chapterCount: number;
}
export interface AdminStorySubmissionListResponse {
  readonly items: readonly AdminStorySubmissionListItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}
export interface AdminStorySubmissionDetail {
  readonly submission: {
    readonly id: string;
    readonly status: AdminSubmissionStatus;
    readonly authorNote: string | null;
    readonly submittedAt: string;
    readonly reviewedAt: string | null;
    readonly rejectionReason: string | null;
    readonly reviewer: { readonly id: string; readonly displayName: string } | null;
  };
  readonly author: {
    readonly id: string;
    readonly displayName: string;
    readonly penName: string;
    readonly slug: string;
    readonly status: string;
  };
  readonly story: {
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly synopsis: string;
    readonly status: string;
    readonly visibility: string;
    readonly coverUrl: string | null;
    readonly categories: readonly {
      readonly id: string;
      readonly name: string;
      readonly slug: string;
    }[];
    readonly tags: readonly { readonly id: string; readonly name: string; readonly slug: string }[];
  };
  readonly chapters: readonly {
    readonly id: string;
    readonly number: string;
    readonly title: string;
    readonly status: string;
    readonly content: string;
    readonly updatedAt: string;
  }[];
  readonly submissionHistory: readonly {
    readonly id: string;
    readonly status: AdminSubmissionStatus;
    readonly submittedAt: string;
    readonly reviewedAt: string | null;
    readonly reviewer: { readonly id: string; readonly displayName: string } | null;
    readonly rejectionReason: string | null;
  }[];
  readonly recentAudit: readonly {
    readonly id: string;
    readonly action: string;
    readonly actorId: string | null;
    readonly requestId: string | null;
    readonly createdAt: string;
  }[];
}

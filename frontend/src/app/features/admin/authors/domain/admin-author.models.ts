export type AuthorLifecycleStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export interface AdminAuthorListItem {
  readonly id: string;
  readonly penName: string;
  readonly slug: string;
  readonly status: AuthorLifecycleStatus;
  readonly statusReason: string | null;
  readonly user: {
    readonly id: string;
    readonly displayName: string;
    readonly email: string;
    readonly status: string;
  };
  readonly storyCount: number;
  readonly createdAt: string;
  readonly statusUpdatedAt: string | null;
}
export interface AdminAuthorListResponse {
  readonly items: readonly AdminAuthorListItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}
export interface AdminAuthorDetail extends AdminAuthorListItem {
  readonly profile: {
    readonly biography: string | null;
    readonly verificationStatus: string;
    readonly verifiedAt: string | null;
    readonly websiteUrl: string | null;
  };
  readonly application: {
    readonly id: string;
    readonly status: string;
    readonly submittedAt: string | null;
    readonly reviewedAt: string | null;
  } | null;
  readonly stories: {
    readonly total: number;
    readonly draft: number;
    readonly published: number;
    readonly pending: number;
  };
  readonly recentEvents: readonly {
    readonly id: string;
    readonly action: string;
    readonly actorId: string | null;
    readonly requestId: string | null;
    readonly createdAt: string;
  }[];
}

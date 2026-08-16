export type AdminReportStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
export type AdminReportReason = 'SPAM' | 'HARASSMENT' | 'HATE_SPEECH' | 'SEXUAL_CONTENT' | 'VIOLENCE' | 'COPYRIGHT' | 'MISINFORMATION' | 'OTHER';

export interface AdminReportListItem {
  readonly id: string;
  readonly status: AdminReportStatus;
  readonly reason: AdminReportReason;
  readonly createdAt: string;
  readonly reporter: { readonly id: string; readonly displayName: string } | null;
  readonly reportedUser: { readonly id: string; readonly displayName: string } | null;
  readonly comment: { readonly id: string; readonly excerpt: string } | null;
  readonly story: { readonly id: string; readonly title: string } | null;
  readonly chapter: { readonly id: string; readonly title: string } | null;
}

export interface AdminReportList {
  readonly items: readonly AdminReportListItem[];
  readonly pagination: { readonly page: number; readonly pageSize: number; readonly totalItems: number; readonly totalPages: number };
}

export interface AdminReportDetail {
  readonly id: string;
  readonly reason: AdminReportReason;
  readonly description: string | null;
  readonly status: AdminReportStatus;
  readonly evidence: unknown;
  readonly resolutionNote: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly resolvedAt: string | null;
  readonly reporter: { readonly id: string; readonly displayName: string; readonly email: string } | null;
  readonly reportedUser: { readonly id: string; readonly displayName: string; readonly email: string; readonly status: string } | null;
  readonly currentComment: { readonly id: string; readonly body: string; readonly moderationStatus: string; readonly editedAt: string | null; readonly createdAt: string; readonly deletedAt: string | null; readonly user: { readonly id: string; readonly displayName: string; readonly status: string } } | null;
  readonly story: { readonly id: string; readonly slug: string; readonly title: string } | null;
  readonly chapter: { readonly id: string; readonly number: number; readonly title: string } | null;
  readonly relatedReportCount: number;
  readonly recentUserModerationCount: number;
  readonly moderationActions: readonly { readonly id: string; readonly actorId: string; readonly action: string; readonly reason: string | null; readonly metadata: unknown; readonly createdAt: string }[];
}

export type AuthorStoryStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'HIATUS'
  | 'SUSPENDED'
  | 'COMPLETED'
  | 'ARCHIVED';

export type AuthorStoryVisibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE';
export type AuthorChapterStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED';

export interface AuthorStoryCategory {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly isPrimary: boolean;
}

export interface AuthorStoryTag {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface AuthorManagedStory {
  readonly id: string;
  readonly authorId: string;
  readonly title: string;
  readonly slug: string;
  readonly synopsis: string;
  readonly languageCode: string;
  readonly status: AuthorStoryStatus;
  readonly visibility: AuthorStoryVisibility;
  readonly contentRating: string;
  readonly coverMediaId: string | null;
  readonly publishedAt: string | null;
  readonly categories: readonly AuthorStoryCategory[];
  readonly tags: readonly AuthorStoryTag[];
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuthorManagedChapterSummary {
  readonly id: string;
  readonly storyId: string;
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly status: AuthorChapterStatus;
  readonly wordCount: number;
  readonly version: number;
  readonly scheduledAt: string | null;
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuthorManagedChapter extends AuthorManagedChapterSummary {
  readonly createdById: string;
  readonly updatedById: string;
  readonly content: string;
  readonly contentFormat: string;
}

export interface AuthorStoryMetadataCategory {
  readonly id: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly slug: string;
  readonly sortOrder: number;
}

export interface AuthorStoryMetadataTag {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface AuthorStoryDraftInput {
  readonly title: string;
  readonly synopsis: string;
  readonly categoryIds: readonly string[];
  readonly tagIds: readonly string[];
}

export interface AuthorStoryUpdateInput extends AuthorStoryDraftInput {
  readonly coverMediaId?: string | null;
}

export interface AuthorChapterDraftInput {
  readonly title: string;
  readonly content: string;
}

export interface AuthorStorySubmission {
  readonly id: string;
  readonly storyId: string;
  readonly submittedById: string;
  readonly reviewedById: string | null;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';
  readonly authorNote: string | null;
  readonly reviewerNote: string | null;
  readonly submittedAt: string;
  readonly reviewedAt: string | null;
  readonly canceledAt: string | null;
}

export interface AuthorStoryPublication {
  readonly story: AuthorManagedStory;
  readonly submission: AuthorStorySubmission;
}

export interface AuthorStoryMedia {
  readonly id: string;
  readonly purpose: string;
  readonly status: string;
  readonly resourceType: string | null;
  readonly deliveryUrl: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly sizeBytes: string | null;
  readonly readyAt: string | null;
}

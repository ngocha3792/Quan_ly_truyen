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
export type AuthorStoryFormat = 'NOVEL' | 'MANGA';
export type AuthorChapterStatus =
  'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED';
export const AUTHOR_STORY_CONTRIBUTOR_ROLES = [
  'CO_AUTHOR',
  'EDITOR',
  'TRANSLATOR',
  'ILLUSTRATOR',
] as const;
export type AuthorStoryContributorRole = (typeof AUTHOR_STORY_CONTRIBUTOR_ROLES)[number];

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
  readonly format: AuthorStoryFormat;
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
  /** Số trang ảnh. Chương truyện tranh có wordCount 0 nhưng pageCount > 0. */
  readonly pageCount: number;
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
  readonly media?: readonly AuthorChapterMediaPage[];
}

export interface AuthorChapterVersionSummary {
  readonly versionType?: 'AUTOSAVE' | 'MANUAL_SAVE' | 'PUBLISHED';
  readonly isRetained?: boolean;
  readonly expiresAt?: string | null;
  readonly id: string;
  readonly chapterId: string;
  readonly createdById: string;
  readonly createdByDisplayName: string;
  readonly version: number;
  readonly title: string;
  readonly wordCount: number;
  readonly changeSummary: string | null;
  readonly createdAt: string;
}

export interface AuthorChapterVersion extends AuthorChapterVersionSummary {
  readonly content: string;
  readonly contentFormat: string;
}

export interface AuthorChapterVersionPage {
  readonly items: readonly AuthorChapterVersionSummary[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
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
  readonly format?: AuthorStoryFormat;
  readonly categoryIds: readonly string[];
  readonly tagIds: readonly string[];
}

export interface AuthorStoryUpdateInput extends AuthorStoryDraftInput {
  readonly coverMediaId?: string | null;
}

export interface ImportedChapterDraft {
  readonly title: string;
  readonly content: string;
}

export interface ChapterImportResult {
  readonly created: readonly { readonly id: string; readonly number: number }[];
  /** Chương không tạo được, kèm vị trí trong danh sách gửi lên. */
  readonly skipped: readonly {
    readonly index: number;
    readonly title: string;
    readonly code: string;
    readonly message: string;
  }[];
}

export interface SkippedBulkChapter {
  readonly chapterId: string;
  readonly number: number;
  readonly title: string;
  readonly code: string;
  readonly message: string;
}

export interface BulkChapterActionResult {
  readonly changed: readonly { readonly id: string }[];
  readonly skipped: readonly SkippedBulkChapter[];
  /** Còn bấy nhiêu chương chưa tới lượt vì vượt trần mỗi lần gọi. */
  readonly remaining: number;
}

export interface AuthorChapterDraftInput {
  readonly title: string;
  readonly content: string;
  readonly expectedVersion?: number;
  /**
   * Chỉ dùng khi tạo mới: chèn chương ngay sau chương này thay vì thêm vào đuôi
   * truyện. Máy chủ chọn số nằm giữa nó và chương liền kề phía sau.
   */
  readonly afterChapterId?: string;

  /**
   * Chỉ dùng khi tạo mới: chèn chương ngay trước chương này. Trỏ vào chương đầu
   * truyện để thêm chương mở đầu.
   */
  readonly beforeChapterId?: string;
}

export interface MonetizationPriceBand {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly creditPrice: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
}

export interface AuthorChapterMonetization {
  readonly unlockPolicy?: 'PERMANENT_PAID' | 'EARLY_ACCESS';
  readonly freeAt?: string | null;
  readonly paidWindowDays?: number | null;
  readonly chapterId: string;
  readonly accessType: 'FREE' | 'PAID';
  readonly priceBandId: string | null;
  readonly creditPrice: string | null;
  readonly previewContent: string | null;
  readonly version: number;
  readonly updatedAt: string;
}

export interface AuthorChapterPricingInput {
  readonly accessType: 'FREE' | 'PAID';
  readonly priceBandId?: string;
  readonly unlockPolicy?: 'PERMANENT_PAID' | 'EARLY_ACCESS';
  readonly freeAt?: string;
  readonly paidWindowDays?: number;
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

export interface AuthorStoryContributor {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: AuthorStoryContributorRole;
  readonly creditName: string | null;
  readonly canEdit: boolean;
  readonly createdAt: string;
}

export interface AuthorStoryContributorInput {
  readonly email: string;
  readonly role: AuthorStoryContributorRole;
  readonly creditName?: string;
  readonly canEdit: boolean;
}

export interface AuthorChapterMediaPage {
  readonly mediaAssetId: string;
  readonly sortOrder: number;
  readonly altText: string | null;
  readonly caption: string | null;
  readonly url: string | null;
  readonly width: number | null;
  readonly height: number | null;
}

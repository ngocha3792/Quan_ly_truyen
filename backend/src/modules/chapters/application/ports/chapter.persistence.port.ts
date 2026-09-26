import type { PublicChapterReaderDto, PublicStoryChapterListDto } from '../dto';
import type { ChapterContentDocument } from '../../domain';

export const CHAPTER_PERSISTENCE_PORT = Symbol('CHAPTER_PERSISTENCE_PORT');

export interface ChapterAuditContext {
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
}

export interface ChapterRecord {
  readonly id: string;

  readonly storyId: string;

  readonly createdById: string;

  readonly updatedById: string;

  readonly number: number;

  readonly title: string;

  readonly slug: string;

  readonly content: string;

  readonly contentDocument: ChapterContentDocument;

  readonly documentSchemaVersion: number;

  readonly contentFormat: string;

  readonly status: string;

  readonly wordCount: number;

  readonly version: number;

  readonly scheduledAt: Date | null;

  readonly publishedAt: Date | null;

  readonly createdAt: Date;

  readonly updatedAt: Date;

  readonly media?: readonly ChapterMediaRecord[];
}

export interface ChapterSummaryRecord {
  readonly id: string;
  readonly storyId: string;
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly status: string;
  readonly wordCount: number;
  /** Số trang ảnh; chương truyện tranh có wordCount 0 nhưng pageCount > 0. */
  readonly pageCount: number;
  readonly version: number;
  readonly scheduledAt: Date | null;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ChapterVersionSummaryRecord {
  readonly versionType?: 'AUTOSAVE' | 'MANUAL_SAVE' | 'PUBLISHED';
  readonly isRetained?: boolean;
  readonly expiresAt?: Date | null;
  readonly id: string;
  readonly chapterId: string;
  readonly createdById: string;
  readonly createdByDisplayName: string;
  readonly version: number;
  readonly title: string;
  readonly wordCount: number;
  readonly changeSummary: string | null;
  readonly createdAt: Date;
}

export interface ChapterVersionRecord extends ChapterVersionSummaryRecord {
  readonly content: string;
  readonly contentDocument: ChapterContentDocument;
  readonly documentSchemaVersion: number;
  readonly contentFormat: string;
}

export interface ChapterVersionPageRecord {
  readonly items: readonly ChapterVersionSummaryRecord[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface CreateAuthorChapterInput {
  readonly userId: string;

  readonly storyId: string;

  readonly title: string;

  readonly content: string;

  readonly wordCount: number;

  /**
   * Chèn chương mới ngay sau chương này thay vì thêm vào đuôi truyện. Số chương
   * sẽ nằm giữa nó và chương liền kề phía sau.
   */
  readonly afterChapterId?: string;

  /**
   * Chèn chương mới ngay trước chương này. Dùng để thêm chương mở đầu: trỏ vào
   * chương đầu truyện thì chương mới nằm giữa 0 và số của nó.
   *
   * Không đi cùng `afterChapterId` — tầng application chặn trước.
   */
  readonly beforeChapterId?: string;

  readonly createdAt: Date;

  readonly audit: ChapterAuditContext;
}

export type CreateAuthorChapterResult =
  | {
      readonly status: 'created';

      readonly chapter: ChapterRecord;
    }
  | {
      readonly status: 'story_not_found';
    }
  | {
      /** `afterChapterId` không thuộc truyện này, hoặc đã bị xoá. */
      readonly status: 'anchor_not_found';
    }
  | {
      /** Hai chương liền kề đã sát nhau, không còn số nào chèn vào giữa. */
      readonly status: 'no_gap';

      readonly afterNumber: number;

      readonly beforeNumber: number;
    };

export interface ImportAuthorChaptersInput {
  readonly userId: string;

  readonly storyId: string;

  /** Đã tách và chuẩn hoá ở tầng application; thứ tự là thứ tự thêm vào đuôi. */
  readonly chapters: readonly {
    readonly title: string;
    readonly content: string;
    readonly wordCount: number;
  }[];

  readonly createdAt: Date;

  readonly audit: ChapterAuditContext;
}

export interface ImportAuthorChaptersResult {
  readonly created: readonly ChapterRecord[];

  /** Chương không tạo được, kèm vị trí trong danh sách gửi lên. */
  readonly skipped: readonly {
    readonly index: number;
    readonly title: string;
    readonly code: string;
    readonly message: string;
  }[];
}

export interface UpdateAuthorChapterInput {
  readonly userId: string;

  readonly storyId: string;

  readonly chapterId: string;

  readonly title?: string;

  readonly content?: string;
  readonly expectedVersion?: number;
  readonly saveType?: 'AUTOSAVE' | 'MANUAL_SAVE';

  readonly wordCount?: number;

  readonly updatedAt: Date;

  readonly audit: ChapterAuditContext;
}

export type UpdateAuthorChapterResult =
  | {
      readonly status: 'updated';

      readonly chapter: ChapterRecord;
    }
  | {
      readonly status: 'not_found';
    }
  | {
      /** Autosave chỉ dành cho bản nháp; xem `ChapterEditPolicy`. */
      readonly status: 'autosave_not_allowed';
    }
  | {
      /** Sửa kiểu này sẽ để lại trang trắng cho độc giả đang đọc. */
      readonly status: 'empty_content';
    }
  | {
      readonly status: 'version_conflict';
      readonly currentVersion: number;
    };

export interface ListAuthorChapterVersionsInput {
  readonly includeAutosaves?: boolean;
  readonly userId: string;
  readonly storyId: string;
  readonly chapterId: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface FindAuthorChapterVersionInput {
  readonly userId: string;
  readonly storyId: string;
  readonly chapterId: string;
  readonly version: number;
}

export interface RestoreAuthorChapterVersionInput {
  readonly expectedVersion?: number;
  readonly userId: string;
  readonly storyId: string;
  readonly chapterId: string;
  readonly version: number;
  readonly restoredAt: Date;
  readonly audit: ChapterAuditContext;
}

export type RestoreAuthorChapterVersionResult =
  | { readonly status: 'version_conflict'; readonly currentVersion: number }
  | {
      readonly status: 'restored';
      readonly chapter: ChapterRecord;
    }
  | { readonly status: 'not_found' }
  | { readonly status: 'version_not_found' };

export interface DeleteAuthorChapterInput {
  readonly userId: string;

  readonly storyId: string;

  readonly chapterId: string;

  readonly deletedAt: Date;

  readonly audit: ChapterAuditContext;
}

export type DeleteAuthorChapterResult =
  | {
      readonly status: 'deleted';
    }
  | {
      readonly status: 'not_found';
    }
  | {
      readonly status: 'story_pending_review';
    };

export interface PublishAuthorChapterInput {
  readonly userId: string;

  readonly storyId: string;

  readonly chapterId: string;

  readonly publishedAt: Date;

  readonly audit: ChapterAuditContext;
}

export type PublishAuthorChapterResult =
  | {
      readonly status: 'published';

      readonly chapter: ChapterRecord;
    }
  | {
      readonly status: 'not_found';
    }
  | {
      readonly status: 'story_not_published';
    }
  | {
      readonly status: 'not_draft';
    }
  | {
      readonly status: 'empty_content';
    };

export interface PublishManyAuthorChaptersInput {
  readonly userId: string;

  readonly storyId: string;

  readonly publishedAt: Date;

  readonly audit: ChapterAuditContext;
}

export interface PublishManyAuthorChaptersResult {
  readonly published: readonly ChapterRecord[];

  /** Chương đủ trạng thái nhưng không xuất bản được, kèm lý do. */
  readonly skipped: readonly {
    readonly chapterId: string;
    readonly number: number;
    readonly title: string;
    readonly status: Exclude<PublishAuthorChapterResult['status'], 'published'>;
  }[];

  readonly remaining: number;
}

export interface ScheduleAuthorChapterInput {
  readonly userId: string;
  readonly storyId: string;
  readonly chapterId: string;
  readonly scheduledAt: Date;
  readonly updatedAt: Date;
  readonly audit: ChapterAuditContext;
}

export type ScheduleAuthorChapterResult =
  | {
      readonly status: 'scheduled';
      readonly chapter: ChapterRecord;
    }
  | { readonly status: 'not_found' }
  | { readonly status: 'story_not_published' }
  | { readonly status: 'not_schedulable' }
  | { readonly status: 'empty_content' };

export interface CancelAuthorChapterScheduleInput {
  readonly userId: string;
  readonly storyId: string;
  readonly chapterId: string;
  readonly canceledAt: Date;
  readonly audit: ChapterAuditContext;
}

export type CancelAuthorChapterScheduleResult =
  | {
      readonly status: 'canceled';
      readonly chapter: ChapterRecord;
    }
  | { readonly status: 'not_found' }
  | { readonly status: 'not_scheduled' };

export interface PublishDueScheduledChaptersInput {
  readonly dueAt: Date;
  readonly batchSize: number;
  readonly requestId?: string;
}

export interface ChapterMediaRecord {
  readonly mediaAssetId: string;
  readonly sortOrder: number;
  readonly altText: string | null;
  readonly caption: string | null;
  readonly url: string | null;
  readonly width: number | null;
  readonly height: number | null;
}

export interface AttachChapterMediaPageInput {
  readonly mediaAssetId: string;
  readonly altText?: string;
  readonly caption?: string;
}

export interface AttachChapterMediaInput {
  readonly userId: string;
  readonly storyId: string;
  readonly chapterId: string;
  readonly pages: readonly AttachChapterMediaPageInput[];
  readonly audit: ChapterAuditContext;
}

export type AttachChapterMediaResult =
  | {
      readonly status: 'attached';
      readonly media: readonly ChapterMediaRecord[];
    }
  | { readonly status: 'not_found' }
  | {
      readonly status: 'invalid_media';
      readonly invalidIds: readonly string[];
    };

export interface ReorderChapterMediaInput {
  readonly userId: string;
  readonly storyId: string;
  readonly chapterId: string;
  readonly orderedMediaAssetIds: readonly string[];
  readonly audit: ChapterAuditContext;
}

export type ReorderChapterMediaResult =
  | {
      readonly status: 'reordered';
      readonly media: readonly ChapterMediaRecord[];
    }
  | { readonly status: 'not_found' }
  | { readonly status: 'mismatch' };

export interface RemoveChapterMediaInput {
  readonly userId: string;
  readonly storyId: string;
  readonly chapterId: string;
  readonly mediaAssetId: string;
  readonly audit: ChapterAuditContext;
}

export type RemoveChapterMediaResult =
  | {
      readonly status: 'removed';
      readonly media: readonly ChapterMediaRecord[];
    }
  | { readonly status: 'not_found' }
  | {
      /** Gỡ nốt trang này thì chương đang hiện ra thành trang trắng. */
      readonly status: 'empty_content';
    };

export interface ChapterPersistencePort {
  listOwnedByStory(
    userId: string,
    storyId: string,
  ): Promise<readonly ChapterSummaryRecord[] | null>;

  findOwnedById(
    userId: string,
    storyId: string,
    chapterId: string,
  ): Promise<ChapterRecord | null>;

  createDraft(
    input: CreateAuthorChapterInput,
  ): Promise<CreateAuthorChapterResult>;

  importDrafts(
    input: ImportAuthorChaptersInput,
  ): Promise<ImportAuthorChaptersResult>;

  updateDraft(
    input: UpdateAuthorChapterInput,
  ): Promise<UpdateAuthorChapterResult>;

  listOwnedVersions(
    input: ListAuthorChapterVersionsInput,
  ): Promise<ChapterVersionPageRecord | null>;

  findOwnedVersion(
    input: FindAuthorChapterVersionInput,
  ): Promise<ChapterVersionRecord | null>;

  restoreDraftVersion(
    input: RestoreAuthorChapterVersionInput,
  ): Promise<RestoreAuthorChapterVersionResult>;

  /**
   * Xoá mềm một chương ở bất kỳ trạng thái nào, kể cả đã xuất bản.
   *
   * Không tự hoàn tiền: nơi gọi phải hoàn xong mọi lượt mua trước khi gọi hàm
   * này, vì xoá trước rồi hoàn sau là để người đọc mất cả tiền lẫn chương.
   */
  deleteOwned(
    input: DeleteAuthorChapterInput,
  ): Promise<DeleteAuthorChapterResult>;

  publish(
    input: PublishAuthorChapterInput,
  ): Promise<PublishAuthorChapterResult>;

  publishMany(
    input: PublishManyAuthorChaptersInput,
  ): Promise<PublishManyAuthorChaptersResult>;

  schedule(
    input: ScheduleAuthorChapterInput,
  ): Promise<ScheduleAuthorChapterResult>;

  cancelSchedule(
    input: CancelAuthorChapterScheduleInput,
  ): Promise<CancelAuthorChapterScheduleResult>;

  publishDueScheduled(input: PublishDueScheduledChaptersInput): Promise<number>;

  attachMedia(
    input: AttachChapterMediaInput,
  ): Promise<AttachChapterMediaResult>;

  reorderMedia(
    input: ReorderChapterMediaInput,
  ): Promise<ReorderChapterMediaResult>;

  removeMedia(
    input: RemoveChapterMediaInput,
  ): Promise<RemoveChapterMediaResult>;

  findPublicReader(
    storySlug: string,
    chapterNumber: string,
    viewerId: string | undefined,
    enforcePaywall: boolean,
  ): Promise<PublicChapterReaderDto | null>;

  listPublishedByStory(
    storySlug: string,
    page: number,
    pageSize: number,
  ): Promise<PublicStoryChapterListDto | null>;
}

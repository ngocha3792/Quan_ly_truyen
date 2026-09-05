import type { PublicChapterReaderDto, PublicStoryChapterListDto } from '../dto';

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

  readonly contentFormat: string;

  readonly status: string;

  readonly wordCount: number;

  readonly version: number;

  readonly scheduledAt: Date | null;

  readonly publishedAt: Date | null;

  readonly createdAt: Date;

  readonly updatedAt: Date;
}

export interface ChapterSummaryRecord {
  readonly id: string;
  readonly storyId: string;
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly status: string;
  readonly wordCount: number;
  readonly version: number;
  readonly scheduledAt: Date | null;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateAuthorChapterInput {
  readonly userId: string;

  readonly storyId: string;

  readonly title: string;

  readonly content: string;

  readonly wordCount: number;

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
      readonly status: 'story_pending_review';
    };

export interface UpdateAuthorChapterInput {
  readonly userId: string;

  readonly storyId: string;

  readonly chapterId: string;

  readonly title?: string;

  readonly content?: string;

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
      readonly status: 'not_draft';
    }
  | {
      readonly status: 'story_pending_review';
    };

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
      readonly status: 'not_draft';
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

  updateDraft(
    input: UpdateAuthorChapterInput,
  ): Promise<UpdateAuthorChapterResult>;

  deleteDraft(
    input: DeleteAuthorChapterInput,
  ): Promise<DeleteAuthorChapterResult>;

  publish(
    input: PublishAuthorChapterInput,
  ): Promise<PublishAuthorChapterResult>;

  findPublicReader(
    storySlug: string,
    chapterNumber: string,
  ): Promise<PublicChapterReaderDto | null>;

  listPublishedByStory(
    storySlug: string,
    page: number,
    pageSize: number,
  ): Promise<PublicStoryChapterListDto | null>;
}

import type { StoryAuditContext } from './story.persistence.port';

export const CHAPTER_PERSISTENCE_PORT = Symbol('CHAPTER_PERSISTENCE_PORT');

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

export interface CreateAuthorChapterInput {
  readonly userId: string;

  readonly storyId: string;

  readonly title: string;

  readonly content: string;

  readonly wordCount: number;

  readonly createdAt: Date;

  readonly audit: StoryAuditContext;
}

export type CreateAuthorChapterResult =
  | {
      readonly status: 'created';

      readonly chapter: ChapterRecord;
    }
  | {
      readonly status: 'story_not_found';
    };

export interface UpdateAuthorChapterInput {
  readonly userId: string;

  readonly storyId: string;

  readonly chapterId: string;

  readonly title?: string;

  readonly content?: string;

  readonly wordCount?: number;

  readonly updatedAt: Date;

  readonly audit: StoryAuditContext;
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
    };

export interface DeleteAuthorChapterInput {
  readonly userId: string;

  readonly storyId: string;

  readonly chapterId: string;

  readonly deletedAt: Date;

  readonly audit: StoryAuditContext;
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
    };

export interface ChapterPersistencePort {
  createDraft(
    input: CreateAuthorChapterInput,
  ): Promise<CreateAuthorChapterResult>;

  updateDraft(
    input: UpdateAuthorChapterInput,
  ): Promise<UpdateAuthorChapterResult>;

  deleteDraft(
    input: DeleteAuthorChapterInput,
  ): Promise<DeleteAuthorChapterResult>;
}

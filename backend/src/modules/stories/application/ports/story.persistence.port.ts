export const STORY_PERSISTENCE_PORT = Symbol('STORY_PERSISTENCE_PORT');

export interface StoryRecord {
  readonly id: string;

  readonly authorId: string;

  readonly title: string;

  readonly slug: string;

  readonly synopsis: string;

  readonly languageCode: string;

  readonly status: string;

  readonly visibility: string;

  readonly contentRating: string;

  readonly version: number;

  readonly createdAt: Date;

  readonly updatedAt: Date;
}

export interface StoryAuditContext {
  readonly ipAddress?: string;

  readonly userAgent?: string;

  readonly requestId?: string;
}

export interface CreateAuthorStoryInput {
  readonly userId: string;

  readonly title: string;

  readonly synopsis: string;

  readonly createdAt: Date;

  readonly audit: StoryAuditContext;
}

export type CreateAuthorStoryResult =
  | {
      readonly status: 'created';

      readonly story: StoryRecord;
    }
  | {
      readonly status: 'author_not_found';
    };

export interface UpdateAuthorStoryInput {
  readonly userId: string;

  readonly storyId: string;

  readonly title?: string;

  readonly synopsis?: string;

  readonly updatedAt: Date;

  readonly audit: StoryAuditContext;
}

export type UpdateAuthorStoryResult =
  | {
      readonly status: 'updated';

      readonly story: StoryRecord;
    }
  | {
      readonly status: 'not_found';
    }
  | {
      readonly status: 'not_draft';
    };

export interface DeleteAuthorStoryInput {
  readonly userId: string;

  readonly storyId: string;

  readonly deletedAt: Date;

  readonly audit: StoryAuditContext;
}

export type DeleteAuthorStoryResult =
  | {
      readonly status: 'deleted';
    }
  | {
      readonly status: 'not_found';
    }
  | {
      readonly status: 'not_draft';
    };

export interface StoryPersistencePort {
  createDraft(input: CreateAuthorStoryInput): Promise<CreateAuthorStoryResult>;

  updateDraft(input: UpdateAuthorStoryInput): Promise<UpdateAuthorStoryResult>;

  deleteDraft(input: DeleteAuthorStoryInput): Promise<DeleteAuthorStoryResult>;
}

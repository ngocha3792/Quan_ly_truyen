import type { PublicStoryDto, PublicStoryPageDto } from '../dto';

export const STORY_PERSISTENCE_PORT = Symbol('STORY_PERSISTENCE_PORT');

export interface StoryCategoryRecord {
  readonly id: string;

  readonly name: string;

  readonly slug: string;

  readonly isPrimary: boolean;
}

export interface StoryTagRecord {
  readonly id: string;

  readonly name: string;

  readonly slug: string;
}

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

  readonly coverMediaId: string | null;

  readonly publishedAt: Date | null;

  readonly categories: readonly StoryCategoryRecord[];

  readonly tags: readonly StoryTagRecord[];

  readonly version: number;

  readonly createdAt: Date;

  readonly updatedAt: Date;
}

export interface StoryTaxonomyCategoryRecord {
  readonly id: string;

  readonly parentId: string | null;

  readonly name: string;

  readonly slug: string;

  readonly sortOrder: number;
}

export interface StoryTaxonomyTagRecord {
  readonly id: string;

  readonly name: string;

  readonly slug: string;
}

export type PublicStoryListSort =
  | 'latest'
  | 'popular'
  | 'rating'
  | 'chapter-count'
  | 'oldest';

export type PublicStoryListStatus = 'ongoing' | 'completed' | 'hiatus';

export interface ListPublicStoriesInput {
  readonly q?: string;
  readonly genre?: string;
  readonly status?: PublicStoryListStatus;
  readonly sort: PublicStoryListSort;
  readonly yearFrom?: number;
  readonly yearTo?: number;
  readonly page: number;
  readonly pageSize: number;
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

  readonly categoryIds: readonly string[];

  readonly tagIds: readonly string[];

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
    }
  | {
      readonly status: 'invalid_categories';

      readonly invalidIds: readonly string[];
    }
  | {
      readonly status: 'invalid_tags';

      readonly invalidIds: readonly string[];
    };

export interface UpdateAuthorStoryInput {
  readonly userId: string;

  readonly storyId: string;

  readonly title?: string;

  readonly synopsis?: string;

  readonly categoryIds?: readonly string[];

  readonly tagIds?: readonly string[];

  readonly coverMediaId?: string | null;

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
    }
  | {
      readonly status: 'invalid_categories';

      readonly invalidIds: readonly string[];
    }
  | {
      readonly status: 'invalid_tags';

      readonly invalidIds: readonly string[];
    }
  | {
      readonly status: 'invalid_cover';
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

export interface StorySubmissionRecord {
  readonly id: string;

  readonly storyId: string;

  readonly submittedById: string;

  readonly reviewedById: string | null;

  readonly status: string;

  readonly authorNote: string | null;

  readonly reviewerNote: string | null;

  readonly submittedAt: Date;

  readonly reviewedAt: Date | null;

  readonly canceledAt: Date | null;
}

export interface StoryPublicationRecord {
  readonly story: StoryRecord;

  readonly submission: StorySubmissionRecord;
}

export interface SubmitAuthorStoryInput {
  readonly userId: string;

  readonly storyId: string;

  readonly authorNote?: string;

  readonly submittedAt: Date;

  readonly audit: StoryAuditContext;
}

export type SubmitAuthorStoryResult =
  | {
      readonly status: 'submitted';

      readonly publication: StoryPublicationRecord;
    }
  | {
      readonly status: 'not_found';
    }
  | {
      readonly status: 'not_draft';
    }
  | {
      readonly status: 'already_pending';
    }
  | {
      readonly status: 'not_ready';

      readonly missing: readonly string[];
    };

export interface CancelAuthorStorySubmissionInput {
  readonly userId: string;

  readonly storyId: string;

  readonly canceledAt: Date;

  readonly audit: StoryAuditContext;
}

export type CancelAuthorStorySubmissionResult =
  | {
      readonly status: 'canceled';

      readonly publication: StoryPublicationRecord;
    }
  | {
      readonly status: 'not_found';
    }
  | {
      readonly status: 'not_pending';
    };

export interface ReviewStorySubmissionInput {
  readonly reviewerId: string;

  readonly submissionId: string;

  readonly reviewerNote?: string;

  readonly reviewedAt: Date;

  readonly audit: StoryAuditContext;
}

export type ReviewStorySubmissionResult =
  | {
      readonly status: 'approved' | 'rejected';

      readonly publication: StoryPublicationRecord;
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
      readonly status: 'not_ready';

      readonly missing: readonly string[];
    };

export interface StoryPersistencePort {
  listOwned(userId: string): Promise<readonly StoryRecord[]>;

  findOwnedById(userId: string, storyId: string): Promise<StoryRecord | null>;

  createDraft(input: CreateAuthorStoryInput): Promise<CreateAuthorStoryResult>;

  updateDraft(input: UpdateAuthorStoryInput): Promise<UpdateAuthorStoryResult>;

  deleteDraft(input: DeleteAuthorStoryInput): Promise<DeleteAuthorStoryResult>;

  submitForReview(input: SubmitAuthorStoryInput): Promise<SubmitAuthorStoryResult>;

  cancelSubmission(
    input: CancelAuthorStorySubmissionInput,
  ): Promise<CancelAuthorStorySubmissionResult>;

  approveSubmission(
    input: ReviewStorySubmissionInput,
  ): Promise<ReviewStorySubmissionResult>;

  rejectSubmission(
    input: ReviewStorySubmissionInput,
  ): Promise<ReviewStorySubmissionResult>;

  listPublic(input: ListPublicStoriesInput): Promise<PublicStoryPageDto>;

  findPublicBySlug(slug: string): Promise<PublicStoryDto | null>;

  listActiveCategories(): Promise<readonly StoryTaxonomyCategoryRecord[]>;

  listTags(): Promise<readonly StoryTaxonomyTagRecord[]>;
}

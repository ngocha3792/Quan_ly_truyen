import type {
  StoryCommentPageResultDto,
  StoryCommentResultDto,
} from '../dto/comment-result.dto';

export const COMMENT_PERSISTENCE_PORT = Symbol('COMMENT_PERSISTENCE_PORT');

export interface CreateStoryCommentInput {
  readonly userId: string;
  readonly storyId: string;
  readonly chapterId?: string;
  readonly body: string;
  readonly createdAt: Date;
}

export interface TextRangeAnchorInput {
  readonly startBlockId: string;
  readonly startOffset: number;
  readonly endBlockId: string;
  readonly endOffset: number;
  readonly quoteText: string;
}

export interface CreateAnchoredCommentInput extends CreateStoryCommentInput {
  readonly chapterId: string;
  readonly anchor: TextRangeAnchorInput;
}

export type CreateAnchoredCommentResult =
  | CreateStoryCommentResult
  | { readonly status: 'invalid_anchor' }
  | { readonly status: 'access_denied' };

export type CreateStoryCommentResult =
  | { readonly status: 'created'; readonly comment: StoryCommentResultDto }
  | { readonly status: 'story_not_found' }
  | { readonly status: 'chapter_not_found' };

export interface UpdateStoryCommentInput {
  readonly userId: string;
  readonly commentId: string;
  readonly body: string;
  readonly updatedAt: Date;
}

export type UpdateStoryCommentResult =
  | { readonly status: 'updated'; readonly comment: StoryCommentResultDto }
  | { readonly status: 'not_found' };

export interface DeleteStoryCommentInput {
  readonly userId: string;
  readonly commentId: string;
  readonly deletedAt: Date;
}

export type DeleteStoryCommentResult =
  { readonly status: 'deleted' } | { readonly status: 'not_found' };

export interface ListCommentsInput {
  readonly storySlug: string;
  readonly chapterNumber?: string;
  readonly page: number;
  readonly pageSize: number;
}

export type ListCommentsResult =
  | { readonly status: 'found'; readonly page: StoryCommentPageResultDto }
  | { readonly status: 'story_not_found' }
  | { readonly status: 'chapter_not_found' };

export interface CommentPersistencePort {
  listComments(input: ListCommentsInput): Promise<ListCommentsResult>;
  createComment(
    input: CreateStoryCommentInput,
  ): Promise<CreateStoryCommentResult>;
  createAnchoredComment(
    input: CreateAnchoredCommentInput,
  ): Promise<CreateAnchoredCommentResult>;
  updateComment(
    input: UpdateStoryCommentInput,
  ): Promise<UpdateStoryCommentResult>;
  deleteComment(
    input: DeleteStoryCommentInput,
  ): Promise<DeleteStoryCommentResult>;
}

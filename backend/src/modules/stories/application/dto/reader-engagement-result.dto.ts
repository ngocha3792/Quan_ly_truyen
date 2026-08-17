export interface StoryCommentUserDto {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

export interface StoryCommentResultDto {
  readonly id: string;
  readonly storyId: string;
  readonly chapterId: string | null;
  readonly parentId: string | null;
  readonly depth: 0 | 1 | 2;
  readonly body: string;
  readonly displayState: 'VISIBLE' | 'DELETED';
  readonly user: StoryCommentUserDto;
  readonly likeCount: number;
  readonly reactions: {
    readonly LIKE: number;
    readonly LOVE: number;
    readonly LAUGH: number;
    readonly INSIGHTFUL: number;
  };
  readonly replyCount: number;
  readonly threadReplyCount: number;
  readonly editedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StoryCommentPageResultDto {
  readonly items: readonly StoryCommentResultDto[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

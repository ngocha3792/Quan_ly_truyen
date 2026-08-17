export interface AuthorFollowMutationView {
  readonly authorId: string;
  readonly isFollowing: boolean;
  readonly followersCount: number;
}

export interface FollowingItemView {
  readonly author: {
    readonly id: string;
    readonly slug: string;
    readonly displayName: string;
    readonly avatarUrl: string | null;
    readonly verified: boolean;
    readonly followersCount: number;
  };
  readonly followedAt: string;
}

export interface FollowingListView {
  readonly items: readonly FollowingItemView[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

export interface ListFollowingInput {
  readonly userId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly authorIds?: readonly string[];
}

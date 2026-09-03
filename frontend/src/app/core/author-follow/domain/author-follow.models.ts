export interface AuthorFollowMutation {
  readonly authorId: string;
  readonly isFollowing: boolean;
  readonly followersCount: number;
}

export interface StoryFollowMutation {
  readonly storyId: string;
  readonly isFollowing: boolean;
  readonly notificationsEnabled: boolean;
  readonly followersCount: number;
}

export interface FollowingAuthorItem {
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

export interface FollowingAuthorsPage {
  readonly items: readonly FollowingAuthorItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

import type {
  AuthorFollowMutationView,
  FollowingListView,
  ListFollowingInput,
  StoryFollowView,
} from '../dto';

export const FOLLOW_REPOSITORY = Symbol.for('modules.follows.repository');

export interface FollowRepositoryPort {
  follow(userId: string, authorId: string): Promise<AuthorFollowMutationView>;
  unfollow(userId: string, authorId: string): Promise<AuthorFollowMutationView>;
  list(input: ListFollowingInput): Promise<FollowingListView>;
  followStory(userId: string, storyId: string): Promise<StoryFollowView>;
  unfollowStory(userId: string, storyId: string): Promise<StoryFollowView>;
  getStoryFollow(userId: string, storyId: string): Promise<StoryFollowView>;
  listStoryFollows(
    userId: string,
    storyIds: readonly string[],
  ): Promise<readonly string[]>;
}

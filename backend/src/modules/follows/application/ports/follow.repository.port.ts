import type {
  AuthorFollowMutationView,
  FollowingListView,
  ListFollowingInput,
} from '../follow.models';

export const FOLLOW_REPOSITORY = Symbol.for('modules.follows.repository');

export interface FollowRepositoryPort {
  follow(userId: string, authorId: string): Promise<AuthorFollowMutationView>;
  unfollow(userId: string, authorId: string): Promise<AuthorFollowMutationView>;
  list(input: ListFollowingInput): Promise<FollowingListView>;
}

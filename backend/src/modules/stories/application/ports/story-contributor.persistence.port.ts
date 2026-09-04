export const STORY_CONTRIBUTOR_PERSISTENCE_PORT = Symbol(
  'STORY_CONTRIBUTOR_PERSISTENCE_PORT',
);

export const STORY_CONTRIBUTOR_ROLES = [
  'CO_AUTHOR',
  'EDITOR',
  'TRANSLATOR',
  'ILLUSTRATOR',
] as const;

export type StoryContributorRoleName = (typeof STORY_CONTRIBUTOR_ROLES)[number];

export interface StoryContributorView {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: StoryContributorRoleName;
  readonly creditName: string | null;
  readonly canEdit: boolean;
  readonly createdAt: string;
}

export interface StoryContributorPersistencePort {
  list(
    ownerId: string,
    storyId: string,
  ): Promise<readonly StoryContributorView[]>;
  upsert(input: {
    readonly ownerId: string;
    readonly storyId: string;
    readonly email: string;
    readonly role: StoryContributorRoleName;
    readonly creditName?: string;
    readonly canEdit: boolean;
  }): Promise<StoryContributorView>;
  remove(input: {
    readonly ownerId: string;
    readonly storyId: string;
    readonly contributorUserId: string;
    readonly role: StoryContributorRoleName;
  }): Promise<void>;
}

import { Inject, Injectable } from '@nestjs/common';
import {
  STORY_CONTRIBUTOR_PERSISTENCE_PORT,
  type StoryContributorPersistencePort,
  type StoryContributorRoleName,
} from '../ports';

@Injectable()
export class StoryContributorUseCases {
  constructor(
    @Inject(STORY_CONTRIBUTOR_PERSISTENCE_PORT)
    private readonly persistence: StoryContributorPersistencePort,
  ) {}

  list(ownerId: string, storyId: string) {
    return this.persistence.list(ownerId, storyId);
  }

  upsert(input: {
    ownerId: string;
    storyId: string;
    email: string;
    role: StoryContributorRoleName;
    creditName?: string;
    canEdit: boolean;
  }) {
    return this.persistence.upsert({
      ...input,
      email: input.email.trim().toLowerCase(),
    });
  }

  remove(input: {
    ownerId: string;
    storyId: string;
    contributorUserId: string;
    role: StoryContributorRoleName;
  }) {
    return this.persistence.remove(input);
  }
}

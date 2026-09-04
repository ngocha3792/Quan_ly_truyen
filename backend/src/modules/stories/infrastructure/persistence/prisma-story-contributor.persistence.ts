import { Injectable } from '@nestjs/common';
import { AccountStatus, ContributorRole } from '@/generated/prisma/client';
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import { PrismaService } from '@/infrastructure/database';
import type {
  StoryContributorPersistencePort,
  StoryContributorRoleName,
  StoryContributorView,
} from '../../application';

@Injectable()
export class PrismaStoryContributorPersistence implements StoryContributorPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    ownerId: string,
    storyId: string,
  ): Promise<readonly StoryContributorView[]> {
    await this.requireOwnedStory(ownerId, storyId);
    const rows = await this.prisma.storyContributor.findMany({
      where: { storyId },
      orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
      include: { user: { select: { email: true, displayName: true } } },
    });
    return rows.map(toView);
  }

  async upsert(input: {
    ownerId: string;
    storyId: string;
    email: string;
    role: StoryContributorRoleName;
    creditName?: string;
    canEdit: boolean;
  }): Promise<StoryContributorView> {
    return this.prisma.$transaction(async (tx) => {
      const story = await tx.story.findFirst({
        where: { id: input.storyId, authorId: input.ownerId, deletedAt: null },
        select: { id: true },
      });
      if (!story) throw storyNotFound(input.storyId);
      const user = await tx.user.findFirst({
        where: {
          email: { equals: input.email, mode: 'insensitive' },
          status: AccountStatus.ACTIVE,
          deletedAt: null,
        },
        select: { id: true, email: true, displayName: true },
      });
      if (!user) {
        throw new ResourceNotFoundException({
          code: 'CONTRIBUTOR_USER_NOT_FOUND',
          resource: 'người dùng cộng tác',
          identifier: input.email,
        });
      }
      if (user.id === input.ownerId) {
        throw new ResourceConflictException({
          code: 'STORY_OWNER_CANNOT_BE_CONTRIBUTOR',
          message: 'Chủ truyện không thể tự thêm mình làm cộng tác viên',
        });
      }
      const row = await tx.storyContributor.upsert({
        where: {
          storyId_userId_role: {
            storyId: input.storyId,
            userId: user.id,
            role: input.role as ContributorRole,
          },
        },
        create: {
          storyId: input.storyId,
          userId: user.id,
          role: input.role as ContributorRole,
          creditName: input.creditName?.trim() || null,
          canEdit: input.canEdit,
        },
        update: {
          creditName: input.creditName?.trim() || null,
          canEdit: input.canEdit,
        },
        include: { user: { select: { email: true, displayName: true } } },
      });
      return toView(row);
    });
  }

  async remove(input: {
    ownerId: string;
    storyId: string;
    contributorUserId: string;
    role: StoryContributorRoleName;
  }): Promise<void> {
    await this.requireOwnedStory(input.ownerId, input.storyId);
    await this.prisma.storyContributor.deleteMany({
      where: {
        storyId: input.storyId,
        userId: input.contributorUserId,
        role: input.role as ContributorRole,
      },
    });
  }

  private async requireOwnedStory(
    ownerId: string,
    storyId: string,
  ): Promise<void> {
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, authorId: ownerId, deletedAt: null },
      select: { id: true },
    });
    if (!story) throw storyNotFound(storyId);
  }
}

function toView(row: {
  userId: string;
  role: ContributorRole;
  creditName: string | null;
  canEdit: boolean;
  createdAt: Date;
  user: { email: string; displayName: string };
}): StoryContributorView {
  return {
    userId: row.userId,
    email: row.user.email,
    displayName: row.user.displayName,
    role: row.role,
    creditName: row.creditName,
    canEdit: row.canEdit,
    createdAt: row.createdAt.toISOString(),
  };
}

function storyNotFound(storyId: string): ResourceNotFoundException {
  return new ResourceNotFoundException({
    code: 'STORY_NOT_FOUND',
    resource: 'truyện thuộc quyền quản lý',
    identifier: storyId,
  });
}

import { Injectable } from '@nestjs/common';
import {
  AccountStatus,
  AuthorLifecycleStatus,
  AuthorVerificationStatus,
  Prisma,
} from '@/generated/prisma/client';
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import { PrismaService } from '@/infrastructure/database';
import type {
  AuthorFollowMutationView,
  FollowingListView,
  ListFollowingInput,
  StoryFollowView,
} from '../../application/dto';
import type { FollowRepositoryPort } from '../../application/ports/follow.repository.port';

@Injectable()
export class PrismaFollowRepository implements FollowRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async follow(
    userId: string,
    authorId: string,
  ): Promise<AuthorFollowMutationView> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockActiveFollower(tx, userId);
      await this.lockAuthor(tx, authorId);
      const target = await tx.authorProfile.findUnique({
        where: { userId: authorId },
        select: {
          userId: true,
          verificationStatus: true,
          lifecycleStatus: true,
          user: { select: { status: true, deletedAt: true } },
        },
      });
      if (!target) throw this.notFound(authorId);
      if (
        target.verificationStatus !== AuthorVerificationStatus.VERIFIED ||
        target.lifecycleStatus !== AuthorLifecycleStatus.ACTIVE ||
        target.user.status !== AccountStatus.ACTIVE ||
        target.user.deletedAt !== null
      ) {
        throw new ResourceConflictException({
          code: 'AUTHOR_NOT_FOLLOWABLE',
          message: 'Tác giả hiện không thể nhận lượt theo dõi mới',
        });
      }

      await tx.userFollowAuthor.createMany({
        data: [{ userId, authorId }],
        skipDuplicates: true,
      });
      const followersCount = await this.reconcileLockedAuthorCount(
        tx,
        authorId,
      );
      return { authorId, isFollowing: true, followersCount };
    });
  }

  async unfollow(
    userId: string,
    authorId: string,
  ): Promise<AuthorFollowMutationView> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAuthor(tx, authorId);
      const target = await tx.authorProfile.findUnique({
        where: { userId: authorId },
        select: { userId: true },
      });
      if (!target) throw this.notFound(authorId);

      await tx.userFollowAuthor.deleteMany({ where: { userId, authorId } });
      const followersCount = await this.reconcileLockedAuthorCount(
        tx,
        authorId,
      );
      return { authorId, isFollowing: false, followersCount };
    });
  }

  async list(input: ListFollowingInput): Promise<FollowingListView> {
    const where: Prisma.UserFollowAuthorWhereInput = {
      userId: input.userId,
      ...(input.authorIds?.length
        ? { authorId: { in: [...input.authorIds] } }
        : {}),
    };
    const skip = (input.page - 1) * input.pageSize;
    const [totalItems, rows] = await Promise.all([
      this.prisma.userFollowAuthor.count({ where }),
      this.prisma.userFollowAuthor.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { authorId: 'desc' }],
        skip,
        take: input.pageSize,
        select: {
          createdAt: true,
          author: {
            select: {
              userId: true,
              slug: true,
              penName: true,
              verificationStatus: true,
              followerCount: true,
              user: {
                select: {
                  avatarMedia: {
                    select: {
                      secureUrl: true,
                      publicUrl: true,
                      status: true,
                      deletedAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      items: rows.map((row) => ({
        author: {
          id: row.author.userId,
          slug: row.author.slug,
          displayName: row.author.penName,
          avatarUrl:
            row.author.user.avatarMedia?.deletedAt === null &&
            row.author.user.avatarMedia.status === 'READY'
              ? (row.author.user.avatarMedia.secureUrl ??
                row.author.user.avatarMedia.publicUrl)
              : null,
          verified:
            row.author.verificationStatus === AuthorVerificationStatus.VERIFIED,
          followersCount: row.author.followerCount,
        },
        followedAt: row.createdAt.toISOString(),
      })),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / input.pageSize),
      },
    };
  }

  async followStory(userId: string, storyId: string): Promise<StoryFollowView> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockActiveFollower(tx, userId);
      const story = await this.lockStory(tx, storyId);
      if (
        !story ||
        story.deleted_at !== null ||
        story.visibility !== 'public' ||
        !['published', 'hiatus', 'completed'].includes(story.status)
      ) {
        throw new ResourceConflictException({
          code: 'STORY_NOT_FOLLOWABLE',
          message: 'Truyện hiện không thể nhận lượt theo dõi mới',
        });
      }

      await tx.storyFollow.createMany({
        data: [{ userId, storyId, notificationsEnabled: true }],
        skipDuplicates: true,
      });
      const followersCount = await this.reconcileLockedStoryCount(tx, storyId);
      return {
        storyId,
        isFollowing: true,
        notificationsEnabled: true,
        followersCount,
      };
    });
  }

  async unfollowStory(
    userId: string,
    storyId: string,
  ): Promise<StoryFollowView> {
    return this.prisma.$transaction(async (tx) => {
      const story = await this.lockStory(tx, storyId);
      if (!story) throw this.storyNotFound(storyId);
      await tx.storyFollow.deleteMany({ where: { userId, storyId } });
      const followersCount = await this.reconcileLockedStoryCount(tx, storyId);
      return {
        storyId,
        isFollowing: false,
        notificationsEnabled: false,
        followersCount,
      };
    });
  }

  async getStoryFollow(
    userId: string,
    storyId: string,
  ): Promise<StoryFollowView> {
    const [story, follow] = await Promise.all([
      this.prisma.story.findFirst({
        where: { id: storyId, deletedAt: null },
        select: { id: true, followerCount: true },
      }),
      this.prisma.storyFollow.findUnique({
        where: { userId_storyId: { userId, storyId } },
        select: { notificationsEnabled: true },
      }),
    ]);
    if (!story) throw this.storyNotFound(storyId);
    return {
      storyId,
      isFollowing: follow !== null,
      notificationsEnabled: follow?.notificationsEnabled ?? false,
      followersCount: story.followerCount,
    };
  }

  async listStoryFollows(
    userId: string,
    storyIds: readonly string[],
  ): Promise<readonly string[]> {
    if (storyIds.length === 0) return [];
    const rows = await this.prisma.storyFollow.findMany({
      where: { userId, storyId: { in: [...storyIds] } },
      select: { storyId: true },
    });
    return rows.map((row) => row.storyId);
  }

  private async lockActiveFollower(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<
      Array<{ id: string; status: string; deleted_at: Date | null }>
    >(Prisma.sql`
      SELECT id, status, deleted_at
      FROM "users"
      WHERE id = ${userId}::uuid
      FOR UPDATE
    `);
    const user = rows[0];
    if (!user || user.status !== 'active' || user.deleted_at !== null) {
      throw new ResourceConflictException({
        code: 'FOLLOWER_ACCOUNT_NOT_ACTIVE',
        message: 'Tài khoản hiện không thể tạo lượt theo dõi mới',
      });
    }
  }

  private async lockAuthor(
    tx: Prisma.TransactionClient,
    authorId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ user_id: string }>>(Prisma.sql`
      SELECT "user_id" FROM "author_profiles"
      WHERE "user_id" = ${authorId}::uuid
      FOR UPDATE
    `);
    if (rows.length === 0) throw this.notFound(authorId);
  }

  private async lockStory(
    tx: Prisma.TransactionClient,
    storyId: string,
  ): Promise<{
    id: string;
    status: string;
    visibility: string;
    deleted_at: Date | null;
  } | null> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        status: string;
        visibility: string;
        deleted_at: Date | null;
      }>
    >(Prisma.sql`
      SELECT id, status, visibility, deleted_at
      FROM "stories"
      WHERE id = ${storyId}::uuid
      FOR UPDATE
    `);
    return rows[0] ?? null;
  }

  private async reconcileLockedAuthorCount(
    tx: Prisma.TransactionClient,
    authorId: string,
  ): Promise<number> {
    const count = await tx.userFollowAuthor.count({ where: { authorId } });
    await tx.authorProfile.update({
      where: { userId: authorId },
      data: { followerCount: count },
    });
    return count;
  }

  private async reconcileLockedStoryCount(
    tx: Prisma.TransactionClient,
    storyId: string,
  ): Promise<number> {
    const count = await tx.storyFollow.count({ where: { storyId } });
    await tx.story.update({
      where: { id: storyId },
      data: { followerCount: count },
    });
    return count;
  }

  private notFound(authorId: string): ResourceNotFoundException {
    return new ResourceNotFoundException({
      code: 'AUTHOR_NOT_FOUND',
      resource: 'tác giả',
      identifier: authorId,
    });
  }

  private storyNotFound(storyId: string): ResourceNotFoundException {
    return new ResourceNotFoundException({
      code: 'STORY_NOT_FOUND',
      resource: 'truyện',
      identifier: storyId,
    });
  }
}

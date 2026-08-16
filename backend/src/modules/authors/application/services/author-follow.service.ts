import { Injectable } from '@nestjs/common';
import {
  AccountStatus,
  AuthorLifecycleStatus,
  AuthorVerificationStatus,
  Prisma,
} from '@/generated/prisma/client';
import {
  InvalidInputException,
  ResourceConflictException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import { PrismaService } from '@/infrastructure/database';

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

@Injectable()
export class AuthorFollowService {
  constructor(private readonly prisma: PrismaService) {}

  async follow(
    userId: string,
    authorId: string,
  ): Promise<AuthorFollowMutationView> {
    if (userId === authorId) {
      throw new ResourceConflictException({
        code: 'AUTHOR_SELF_FOLLOW_NOT_ALLOWED',
        message: 'Bạn không thể theo dõi chính mình',
      });
    }

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

  async list(input: {
    userId: string;
    page: number;
    pageSize: number;
    authorIds?: readonly string[];
  }): Promise<FollowingListView> {
    const page = Math.max(1, input.page);
    const pageSize = Math.min(Math.max(input.pageSize, 1), 100);
    const authorIds = input.authorIds?.length
      ? [...new Set(input.authorIds)]
      : undefined;
    if (authorIds && authorIds.length > 50) {
      throw new InvalidInputException({
        code: 'FOLLOW_AUTHOR_IDS_LIMIT_EXCEEDED',
        message: 'Chỉ được kiểm tra tối đa 50 tác giả mỗi lần',
      });
    }
    const where: Prisma.UserFollowAuthorWhereInput = {
      userId: input.userId,
      ...(authorIds ? { authorId: { in: authorIds } } : {}),
    };
    const skip = (page - 1) * pageSize;
    const [totalItems, rows] = await Promise.all([
      this.prisma.userFollowAuthor.count({ where }),
      this.prisma.userFollowAuthor.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { authorId: 'desc' }],
        skip,
        take: pageSize,
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
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
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

  private notFound(authorId: string): ResourceNotFoundException {
    return new ResourceNotFoundException({
      code: 'AUTHOR_NOT_FOUND',
      resource: 'tác giả',
      identifier: authorId,
    });
  }
}

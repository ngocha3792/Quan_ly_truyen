import { Injectable } from '@nestjs/common';
import type { AuthorLifecyclePersistencePort } from '../../application/ports';
import { Prisma, StoryStatus } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import {
  AuthorLifecycleNotActiveException,
  AuthorLifecycleStatus,
  AuthorStatusReasonRequiredException,
  ManagedAuthorNotFoundException,
} from '../../domain';
import type { AdminAuthorDetailDto, AdminAuthorListDto } from '../../application/dto';

@Injectable()
export class PrismaAuthorLifecyclePersistence implements AuthorLifecyclePersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async assertActiveAuthor(userId: string): Promise<void> {
    const author = await this.prisma.authorProfile.findUnique({
      where: { userId },
      select: { lifecycleStatus: true },
    });
    if (!author) throw new AuthorLifecycleNotActiveException('MISSING');
    if (author.lifecycleStatus !== 'ACTIVE') {
      throw new AuthorLifecycleNotActiveException(author.lifecycleStatus);
    }
  }

  async list(input: {
    search?: string;
    status?: AuthorLifecycleStatus;
    createdFrom?: Date;
    createdTo?: Date;
    page: number;
    pageSize: number;
  }): Promise<AdminAuthorListDto> {
    const search = input.search?.trim();
    const where: Prisma.AuthorProfileWhereInput = {
      ...(input.status ? { lifecycleStatus: input.status } : {}),
      ...(input.createdFrom || input.createdTo
        ? {
            createdAt: {
              ...(input.createdFrom ? { gte: input.createdFrom } : {}),
              ...(input.createdTo ? { lte: input.createdTo } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { penName: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
              {
                user: {
                  OR: [
                    { displayName: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };
    const skip = (input.page - 1) * input.pageSize;
    const [totalItems, records] = await Promise.all([
      this.prisma.authorProfile.count({ where }),
      this.prisma.authorProfile.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { userId: 'asc' }],
        skip,
        take: input.pageSize,
        select: {
          userId: true,
          penName: true,
          slug: true,
          lifecycleStatus: true,
          statusReason: true,
          statusUpdatedAt: true,
          storyCount: true,
          createdAt: true,
          user: {
            select: { id: true, displayName: true, email: true, status: true },
          },
        },
      }),
    ]);
    return {
      items: records.map((record) => ({
        id: record.userId,
        penName: record.penName,
        slug: record.slug,
        status: record.lifecycleStatus,
        statusReason: record.statusReason,
        user: {
          id: record.user.id,
          displayName: record.user.displayName,
          email: record.user.email,
          status: record.user.status,
        },
        storyCount: record.storyCount,
        createdAt: record.createdAt.toISOString(),
        statusUpdatedAt: record.statusUpdatedAt?.toISOString() ?? null,
      })),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / input.pageSize),
      },
    };
  }

  async detail(authorId: string): Promise<AdminAuthorDetailDto> {
    const record = await this.prisma.authorProfile.findUnique({
      where: { userId: authorId },
      select: {
        userId: true,
        penName: true,
        slug: true,
        biography: true,
        verificationStatus: true,
        verifiedAt: true,
        lifecycleStatus: true,
        statusReason: true,
        statusUpdatedAt: true,
        websiteUrl: true,
        storyCount: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            status: true,
            authorApplication: {
              select: {
                id: true,
                status: true,
                submittedAt: true,
                reviewedAt: true,
              },
            },
          },
        },
      },
    });
    if (!record) throw new ManagedAuthorNotFoundException(authorId);
    const [storyGroups, recentEvents] = await Promise.all([
      this.prisma.story.groupBy({
        by: ['status'],
        where: { authorId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.auditLog.findMany({
        where: {
          OR: [
            { entityType: 'author', entityId: authorId },
            { entityType: 'story', actorId: authorId },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
        select: {
          id: true,
          action: true,
          actorId: true,
          requestId: true,
          createdAt: true,
        },
      }),
    ]);
    const counts = new Map(
      storyGroups.map((item) => [item.status, item._count._all]),
    );
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    return {
      id: record.userId,
      penName: record.penName,
      slug: record.slug,
      status: record.lifecycleStatus,
      statusReason: record.statusReason,
      user: {
        id: record.user.id,
        displayName: record.user.displayName,
        email: record.user.email,
        status: record.user.status,
      },
      storyCount: record.storyCount,
      createdAt: record.createdAt.toISOString(),
      statusUpdatedAt: record.statusUpdatedAt?.toISOString() ?? null,
      profile: {
        biography: record.biography,
        verificationStatus: record.verificationStatus,
        verifiedAt: record.verifiedAt?.toISOString() ?? null,
        websiteUrl: record.websiteUrl,
      },
      application: record.user.authorApplication
        ? {
            id: record.user.authorApplication.id,
            status: record.user.authorApplication.status,
            submittedAt:
              record.user.authorApplication.submittedAt?.toISOString() ?? null,
            reviewedAt:
              record.user.authorApplication.reviewedAt?.toISOString() ?? null,
          }
        : null,
      stories: {
        total,
        draft: counts.get(StoryStatus.DRAFT) ?? 0,
        published:
          (counts.get(StoryStatus.PUBLISHED) ?? 0) +
          (counts.get(StoryStatus.HIATUS) ?? 0) +
          (counts.get(StoryStatus.COMPLETED) ?? 0),
        pending: counts.get(StoryStatus.PENDING_REVIEW) ?? 0,
      },
      recentEvents: recentEvents.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  async changeStatus(input: {
    actorUserId: string;
    authorId: string;
    status: AuthorLifecycleStatus;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  }): Promise<AdminAuthorDetailDto> {
    const reason = input.reason?.trim() || null;
    if (
      input.status !== AuthorLifecycleStatus.ACTIVE &&
      (!reason || reason.length < 10)
    )
      throw new AuthorStatusReasonRequiredException();
    const changedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ user_id: string }>
      >`SELECT "user_id" FROM "author_profiles" WHERE "user_id" = ${input.authorId}::uuid FOR UPDATE`;
      if (locked.length === 0)
        throw new ManagedAuthorNotFoundException(input.authorId);
      const current = await tx.authorProfile.findUnique({
        where: { userId: input.authorId },
        select: { lifecycleStatus: true, statusReason: true },
      });
      if (!current) throw new ManagedAuthorNotFoundException(input.authorId);
      const nextStatus = input.status;
      if (
        String(current.lifecycleStatus) === String(nextStatus) &&
        current.statusReason === reason
      )
        return;
      await tx.authorProfile.update({
        where: { userId: input.authorId },
        data: {
          lifecycleStatus: nextStatus,
          statusReason: reason,
          statusUpdatedAt: changedAt,
          statusUpdatedBy: input.actorUserId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: input.actorUserId,
          action: 'AUTHOR_STATUS_CHANGED',
          entityType: 'author',
          entityId: input.authorId,
          oldValues: {
            status: current.lifecycleStatus,
            reason: current.statusReason,
          },
          newValues: { status: nextStatus, reason },
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          createdAt: changedAt,
        },
      });
    });
    return this.detail(input.authorId);
  }
}

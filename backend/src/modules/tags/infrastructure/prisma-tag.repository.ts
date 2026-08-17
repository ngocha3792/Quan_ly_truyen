import { Injectable } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import { createUniqueSlug, slugify } from '@/common/utils/slug.util';
import {
  TagInUseException,
  TagMergeTargetNotFoundException,
  TagNameAlreadyExistsException,
  TagNotFoundException,
  TagSlugGenerationException,
} from '../domain';
import type {
  AdminTagItem,
  AdminTagList,
  ListTagsInput,
  TagAuditContext,
} from '../application/tag.models';
import type { TagRepositoryPort } from '../application/ports/tag.repository.port';

const SLUG_ATTEMPTS = 16;

@Injectable()
export class PrismaTagRepository implements TagRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: ListTagsInput): Promise<AdminTagList> {
    const where: Prisma.TagWhereInput = input.q
      ? {
          OR: [
            { name: { contains: input.q, mode: 'insensitive' } },
            { slug: { contains: input.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const orderBy: Prisma.TagOrderByWithRelationInput =
      input.sort === 'name:desc'
        ? { name: 'desc' }
        : input.sort === 'createdAt:asc'
          ? { createdAt: 'asc' }
          : input.sort === 'createdAt:desc'
            ? { createdAt: 'desc' }
            : { name: 'asc' };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.tag.findMany({
        where,
        orderBy: [orderBy, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: { _count: { select: { stories: true } } },
      }),
      this.prisma.tag.count({ where }),
    ]);
    return {
      items: items.map((item): AdminTagItem => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        storyCount: item._count.stories,
        createdAt: item.createdAt,
      })),
      pagination: page(input.page, input.pageSize, totalItems),
    };
  }

  async create(name: string, audit: TagAuditContext): Promise<AdminTagItem> {
    const baseSlug = slugify(name, { maxLength: 100 }) || 'tag';
    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
      const slug = taxonomySlug(baseSlug, attempt, 100);
      try {
        return await this.prisma.$transaction(async (tx) => {
          const tag = await tx.tag.create({ data: { name, slug } });
          await writeAudit(tx, audit, 'tag.created', 'tag', tag.id, undefined, {
            name: tag.name,
            slug: tag.slug,
          });
          return { ...tag, storyCount: 0 };
        });
      } catch (error: unknown) {
        if (!isUniqueViolation(error)) throw error;
        if (await this.findByNormalizedName(name))
          throw new TagNameAlreadyExistsException(name);
      }
    }
    throw new TagSlugGenerationException();
  }

  async update(
    id: string,
    name: string,
    audit: TagAuditContext,
  ): Promise<AdminTagItem> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await this.lockTags(tx, [id]);
        if (locked.length !== 1) throw new TagNotFoundException(id);
        const current = await tx.tag.findUnique({
          where: { id },
          include: { _count: { select: { stories: true } } },
        });
        if (!current) throw new TagNotFoundException(id);
        const duplicate = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "tags" WHERE LOWER("name") = LOWER(${name}) AND "id" <> ${id}::uuid LIMIT 1`,
        );
        if (duplicate.length > 0) throw new TagNameAlreadyExistsException(name);
        const updated = await tx.tag.update({
          where: { id },
          data: { name },
          include: { _count: { select: { stories: true } } },
        });
        await writeAudit(
          tx,
          audit,
          'tag.updated',
          'tag',
          id,
          { name: current.name },
          { name: updated.name },
        );
        return {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          storyCount: updated._count.stories,
          createdAt: updated.createdAt,
        };
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) throw new TagNameAlreadyExistsException(name);
      throw error;
    }
  }

  async delete(id: string, audit: TagAuditContext): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockTags(tx, [id]);
      if (locked.length !== 1) throw new TagNotFoundException(id);
      const current = await tx.tag.findUnique({
        where: { id },
        include: { _count: { select: { stories: true } } },
      });
      if (!current) throw new TagNotFoundException(id);
      if (current._count.stories > 0)
        throw new TagInUseException(current._count.stories);
      await tx.tag.delete({ where: { id } });
      await writeAudit(tx, audit, 'tag.deleted', 'tag', id, {
        name: current.name,
        slug: current.slug,
        storyCount: 0,
      });
    });
  }

  async merge(
    sourceTagId: string,
    targetTagId: string,
    audit: TagAuditContext,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await this.lockTags(tx, [sourceTagId, targetTagId]);
      if (!locked.includes(sourceTagId)) throw new TagNotFoundException(sourceTagId);
      if (!locked.includes(targetTagId))
        throw new TagMergeTargetNotFoundException(targetTagId);
      const [source, target, sourceLinks, targetLinks] = await Promise.all([
        tx.tag.findUnique({ where: { id: sourceTagId } }),
        tx.tag.findUnique({ where: { id: targetTagId } }),
        tx.storyTag.findMany({
          where: { tagId: sourceTagId },
          select: { storyId: true },
        }),
        tx.storyTag.findMany({
          where: { tagId: targetTagId },
          select: { storyId: true },
        }),
      ]);
      if (!source) throw new TagNotFoundException(sourceTagId);
      if (!target) throw new TagMergeTargetNotFoundException(targetTagId);
      const targetStoryIds = new Set(targetLinks.map(({ storyId }) => storyId));
      const deduplicatedStoryCount = sourceLinks.filter(({ storyId }) =>
        targetStoryIds.has(storyId),
      ).length;
      const toCreate = sourceLinks.filter(
        ({ storyId }) => !targetStoryIds.has(storyId),
      );
      if (toCreate.length > 0)
        await tx.storyTag.createMany({
          data: toCreate.map(({ storyId }) => ({
            storyId,
            tagId: targetTagId,
          })),
          skipDuplicates: true,
        });
      await tx.storyTag.deleteMany({ where: { tagId: sourceTagId } });
      await tx.tag.delete({ where: { id: sourceTagId } });
      const storyCount = await tx.storyTag.count({
        where: { tagId: targetTagId },
      });
      await writeAudit(
        tx,
        audit,
        'tag.merged',
        'tag',
        sourceTagId,
        undefined,
        undefined,
        {
          sourceTag: { id: source.id, name: source.name, slug: source.slug },
          targetTagId: target.id,
          targetTagName: target.name,
          movedStoryCount: toCreate.length,
          deduplicatedStoryCount,
        },
      );
      return {
        target: {
          id: target.id,
          name: target.name,
          slug: target.slug,
          storyCount,
        },
        merged: {
          sourceTagId,
          movedStoryCount: toCreate.length,
          deduplicatedStoryCount,
        },
      };
    });
  }

  private async findByNormalizedName(name: string) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "tags" WHERE LOWER("name") = LOWER(${name}) LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async lockTags(
    tx: Prisma.TransactionClient,
    ids: readonly string[],
  ): Promise<readonly string[]> {
    if (ids.length === 0) return [];
    const sorted = [...new Set(ids)].sort();
    if (sorted.length === 1) {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "tags" WHERE "id" = ${sorted[0]}::uuid FOR UPDATE
      `);
      return rows.map(({ id }) => id);
    }
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "tags"
      WHERE "id" IN (${sorted[0]}::uuid, ${sorted[1]}::uuid)
      ORDER BY "id" FOR UPDATE
    `);
    return rows.map(({ id }) => id);
  }
}

function page(pageNumber: number, pageSize: number, totalItems: number) {
  return {
    page: pageNumber,
    pageSize,
    totalItems,
    totalPages: Math.ceil(totalItems / pageSize),
  };
}

function taxonomySlug(base: string, attempt: number, maxLength: number): string {
  if (attempt === 0) return base.slice(0, maxLength).replace(/-+$/u, '');
  const candidate = createUniqueSlug(base, attempt + 1);
  if (candidate.length <= maxLength) return candidate;
  const suffix = `-${attempt + 1}`;
  return `${base.slice(0, Math.max(1, maxLength - suffix.length)).replace(/-+$/u, '')}${suffix}`;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  audit: TagAuditContext,
  action: string,
  entityType: string,
  entityId: string,
  oldValues?: Prisma.InputJsonValue,
  newValues?: Prisma.InputJsonValue,
  metadata?: Prisma.InputJsonValue,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: audit.actorId,
      action,
      entityType,
      entityId,
      ...(oldValues === undefined ? {} : { oldValues }),
      ...(newValues === undefined ? {} : { newValues }),
      ...(metadata === undefined ? {} : { metadata }),
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
      requestId: audit.requestId,
    },
  });
}

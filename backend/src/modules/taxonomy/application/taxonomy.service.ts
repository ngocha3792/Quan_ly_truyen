import { Injectable } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client';
import { createUniqueSlug, slugify } from '@/common/utils/slug.util';
import {
  CategoryHasActiveChildrenException,
  CategoryHasChildrenException,
  CategoryHierarchyCycleException,
  CategoryInUseException,
  CategoryNameAlreadyExistsException,
  CategoryNotFoundException,
  CategoryParentInactiveException,
  CategoryParentNotFoundException,
  normalizeTaxonomyName,
  TagCannotMergeIntoSelfException,
  TagInUseException,
  TagMergeTargetNotFoundException,
  TagNameAlreadyExistsException,
  TagNotFoundException,
  TaxonomySlugGenerationException,
} from '../domain';
import { PrismaTaxonomyRepository } from '../infrastructure';
import type {
  AdminCategoryItem,
  AdminCategoryList,
  AdminTagItem,
  AdminTagList,
  TaxonomyAuditContext,
} from './taxonomy.models';

const SLUG_ATTEMPTS = 16;

@Injectable()
export class TaxonomyService {
  constructor(private readonly repository: PrismaTaxonomyRepository) {}

  async listTags(input: {
    q?: string;
    page: number;
    pageSize: number;
    sort: string;
  }): Promise<AdminTagList> {
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
    const [items, totalItems] = await this.repository.prisma.$transaction([
      this.repository.prisma.tag.findMany({
        where,
        orderBy: [orderBy, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: { _count: { select: { stories: true } } },
      }),
      this.repository.prisma.tag.count({ where }),
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

  async createTag(
    nameInput: string,
    audit: TaxonomyAuditContext,
  ): Promise<AdminTagItem> {
    const name = normalizeTaxonomyName(nameInput);
    const baseSlug = slugify(name, { maxLength: 100 }) || 'tag';
    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
      const slug = taxonomySlug(baseSlug, attempt, 100);
      try {
        return await this.repository.prisma.$transaction(async (tx) => {
          const tag = await tx.tag.create({ data: { name, slug } });
          await writeAudit(tx, audit, 'tag.created', 'tag', tag.id, undefined, {
            name: tag.name,
            slug: tag.slug,
          });
          return { ...tag, storyCount: 0 };
        });
      } catch (error: unknown) {
        if (!isUniqueViolation(error)) throw error;
        if (await this.repository.findTagByNormalizedName(name))
          throw new TagNameAlreadyExistsException(name);
      }
    }
    throw new TaxonomySlugGenerationException('tag');
  }

  async updateTag(
    id: string,
    nameInput: string,
    audit: TaxonomyAuditContext,
  ): Promise<AdminTagItem> {
    const name = normalizeTaxonomyName(nameInput);
    try {
      return await this.repository.prisma.$transaction(async (tx) => {
        const locked = await this.repository.lockTags(tx, [id]);
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
      if (isUniqueViolation(error))
        throw new TagNameAlreadyExistsException(name);
      throw error;
    }
  }

  async deleteTag(id: string, audit: TaxonomyAuditContext): Promise<void> {
    await this.repository.prisma.$transaction(async (tx) => {
      const locked = await this.repository.lockTags(tx, [id]);
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

  async mergeTag(
    sourceTagId: string,
    targetTagId: string,
    audit: TaxonomyAuditContext,
  ) {
    if (sourceTagId === targetTagId)
      throw new TagCannotMergeIntoSelfException();
    return this.repository.prisma.$transaction(async (tx) => {
      const locked = await this.repository.lockTags(tx, [
        sourceTagId,
        targetTagId,
      ]);
      if (!locked.includes(sourceTagId))
        throw new TagNotFoundException(sourceTagId);
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

  async listCategories(input: {
    q?: string;
    isActive?: boolean;
    parentId?: string;
    page: number;
    pageSize: number;
    sort: string;
  }): Promise<AdminCategoryList> {
    const where: Prisma.CategoryWhereInput = {
      ...(input.q
        ? {
            OR: [
              { name: { contains: input.q, mode: 'insensitive' } },
              { slug: { contains: input.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      ...(input.parentId === undefined
        ? {}
        : { parentId: input.parentId === 'root' ? null : input.parentId }),
    };
    const orderBy: Prisma.CategoryOrderByWithRelationInput[] =
      input.sort === 'name:asc'
        ? [{ name: 'asc' }, { id: 'asc' }]
        : input.sort === 'createdAt:desc'
          ? [{ createdAt: 'desc' }, { id: 'desc' }]
          : [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }];
    const [items, totalItems] = await this.repository.prisma.$transaction([
      this.repository.prisma.category.findMany({
        where,
        orderBy,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: {
          parent: { select: { id: true, name: true, slug: true } },
          _count: { select: { stories: true, children: true } },
        },
      }),
      this.repository.prisma.category.count({ where }),
    ]);
    return {
      items: items.map(toCategoryItem),
      pagination: page(input.page, input.pageSize, totalItems),
    };
  }

  async createCategory(
    input: {
      name: string;
      description?: string | null;
      parentId?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    },
    audit: TaxonomyAuditContext,
  ): Promise<AdminCategoryItem> {
    const name = normalizeTaxonomyName(input.name);
    const baseSlug = slugify(name, { maxLength: 120 }) || 'category';
    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
      const slug = taxonomySlug(baseSlug, attempt, 120);
      try {
        return await this.repository.prisma.$transaction(async (tx) => {
          const isActive = input.isActive ?? true;
          if (input.parentId)
            await assertParentEligible(tx, input.parentId, isActive);
          const category = await tx.category.create({
            data: {
              name,
              slug,
              description: input.description ?? null,
              parentId: input.parentId ?? null,
              sortOrder: input.sortOrder ?? 0,
              isActive,
            },
            include: {
              parent: { select: { id: true, name: true, slug: true } },
              _count: { select: { stories: true, children: true } },
            },
          });
          await writeAudit(
            tx,
            audit,
            'category.created',
            'category',
            category.id,
            undefined,
            categoryAuditValues(category),
          );
          return toCategoryItem(category);
        });
      } catch (error: unknown) {
        if (!isUniqueViolation(error)) throw error;
        if (await this.repository.findCategoryByNormalizedName(name))
          throw new CategoryNameAlreadyExistsException(name);
      }
    }
    throw new TaxonomySlugGenerationException('category');
  }

  async updateCategory(
    id: string,
    input: {
      name?: string;
      description?: string | null;
      parentId?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    },
    audit: TaxonomyAuditContext,
  ): Promise<AdminCategoryItem> {
    const name =
      input.name === undefined ? undefined : normalizeTaxonomyName(input.name);
    try {
      return await this.repository.prisma.$transaction(async (tx) => {
        if (!(await this.repository.lockCategory(tx, id)))
          throw new CategoryNotFoundException(id);
        const current = await tx.category.findUnique({
          where: { id },
          include: {
            parent: { select: { id: true, name: true, slug: true } },
            _count: { select: { stories: true, children: true } },
          },
        });
        if (!current) throw new CategoryNotFoundException(id);
        if (name !== undefined) {
          const duplicates = await tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`SELECT "id" FROM "categories" WHERE LOWER("name") = LOWER(${name}) AND "id" <> ${id}::uuid LIMIT 1`,
          );
          if (duplicates.length > 0)
            throw new CategoryNameAlreadyExistsException(name);
        }
        const nextParentId =
          input.parentId === undefined ? current.parentId : input.parentId;
        const nextActive = input.isActive ?? current.isActive;
        if (nextParentId === id) throw new CategoryHierarchyCycleException();
        if (nextParentId) {
          await assertParentEligible(tx, nextParentId, nextActive);
          await assertNoCategoryCycle(tx, id, nextParentId);
        }
        if (current.isActive && input.isActive === false) {
          const activeChildren = await tx.category.count({
            where: { parentId: id, isActive: true },
          });
          if (activeChildren > 0)
            throw new CategoryHasActiveChildrenException(activeChildren);
        }
        const updated = await tx.category.update({
          where: { id },
          data: {
            ...(name === undefined ? {} : { name }),
            ...(input.description === undefined
              ? {}
              : { description: input.description }),
            ...(input.parentId === undefined
              ? {}
              : { parentId: input.parentId }),
            ...(input.sortOrder === undefined
              ? {}
              : { sortOrder: input.sortOrder }),
            ...(input.isActive === undefined
              ? {}
              : { isActive: input.isActive }),
          },
          include: {
            parent: { select: { id: true, name: true, slug: true } },
            _count: { select: { stories: true, children: true } },
          },
        });
        const action =
          current.isActive !== updated.isActive
            ? updated.isActive
              ? 'category.activated'
              : 'category.deactivated'
            : 'category.updated';
        await writeAudit(
          tx,
          audit,
          action,
          'category',
          id,
          categoryAuditValues(current),
          categoryAuditValues(updated),
        );
        return toCategoryItem(updated);
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error) && name !== undefined)
        throw new CategoryNameAlreadyExistsException(name);
      throw error;
    }
  }

  async deleteCategory(id: string, audit: TaxonomyAuditContext): Promise<void> {
    await this.repository.prisma.$transaction(async (tx) => {
      if (!(await this.repository.lockCategory(tx, id)))
        throw new CategoryNotFoundException(id);
      const current = await tx.category.findUnique({
        where: { id },
        include: { _count: { select: { stories: true, children: true } } },
      });
      if (!current) throw new CategoryNotFoundException(id);
      if (current._count.stories > 0)
        throw new CategoryInUseException(current._count.stories);
      if (current._count.children > 0)
        throw new CategoryHasChildrenException(current._count.children);
      await tx.category.delete({ where: { id } });
      await writeAudit(
        tx,
        audit,
        'category.deleted',
        'category',
        id,
        categoryAuditValues(current),
      );
    });
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
function taxonomySlug(
  base: string,
  attempt: number,
  maxLength: number,
): string {
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

async function assertParentEligible(
  tx: Prisma.TransactionClient,
  parentId: string,
  childActive: boolean,
): Promise<void> {
  const parent = await tx.category.findUnique({
    where: { id: parentId },
    select: { id: true, isActive: true },
  });
  if (!parent) throw new CategoryParentNotFoundException(parentId);
  if (childActive && !parent.isActive)
    throw new CategoryParentInactiveException(parentId);
}

async function assertNoCategoryCycle(
  tx: Prisma.TransactionClient,
  categoryId: string,
  parentId: string,
): Promise<void> {
  let cursor: string | null = parentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === categoryId || seen.has(cursor))
      throw new CategoryHierarchyCycleException();
    seen.add(cursor);
    const parent: { parentId: string | null } | null =
      await tx.category.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
    cursor = parent?.parentId ?? null;
  }
}

function toCategoryItem(item: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  parent: { id: string; name: string; slug: string } | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { stories: number; children: number };
}): AdminCategoryItem {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description,
    parentId: item.parentId,
    parent: item.parent,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    storyCount: item._count.stories,
    childCount: item._count.children,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function categoryAuditValues(item: {
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
}) {
  return {
    name: item.name,
    slug: item.slug,
    parentId: item.parentId,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
  };
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  audit: TaxonomyAuditContext,
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

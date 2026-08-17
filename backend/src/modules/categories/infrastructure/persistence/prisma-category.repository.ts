import { Injectable } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
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
  CategorySlugGenerationException,
} from '../../domain';
import type {
  AdminCategoryItem,
  AdminCategoryList,
  CategoryAuditContext,
  CreateCategoryInput,
  ListCategoriesInput,
  UpdateCategoryInput,
} from '../../application/dto';
import type { CategoryRepositoryPort } from '../../application/ports/category.repository.port';

const SLUG_ATTEMPTS = 16;

@Injectable()
export class PrismaCategoryRepository implements CategoryRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: ListCategoriesInput): Promise<AdminCategoryList> {
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
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        orderBy,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: {
          parent: { select: { id: true, name: true, slug: true } },
          _count: { select: { stories: true, children: true } },
        },
      }),
      this.prisma.category.count({ where }),
    ]);
    return {
      items: items.map(toCategoryItem),
      pagination: page(input.page, input.pageSize, totalItems),
    };
  }

  async create(
    input: CreateCategoryInput,
    audit: CategoryAuditContext,
  ): Promise<AdminCategoryItem> {
    const name = input.name;
    const baseSlug = slugify(name, { maxLength: 120 }) || 'category';
    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
      const slug = taxonomySlug(baseSlug, attempt, 120);
      try {
        return await this.prisma.$transaction(async (tx) => {
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
        if (await this.findByNormalizedName(name))
          throw new CategoryNameAlreadyExistsException(name);
      }
    }
    throw new CategorySlugGenerationException();
  }

  async update(
    id: string,
    input: UpdateCategoryInput,
    audit: CategoryAuditContext,
  ): Promise<AdminCategoryItem> {
    const name = input.name;
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!(await lockCategory(tx, id))) throw new CategoryNotFoundException(id);
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
            ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
            ...(input.sortOrder === undefined
              ? {}
              : { sortOrder: input.sortOrder }),
            ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
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

  async delete(id: string, audit: CategoryAuditContext): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (!(await lockCategory(tx, id))) throw new CategoryNotFoundException(id);
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

  private async findByNormalizedName(name: string) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "categories" WHERE LOWER("name") = LOWER(${name}) LIMIT 1
    `);
    return rows[0] ?? null;
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

async function lockCategory(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "categories" WHERE "id" = ${id}::uuid FOR UPDATE
  `);
  return rows.length === 1;
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
  audit: CategoryAuditContext,
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

import { Injectable } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';

@Injectable()
export class PrismaTaxonomyRepository {
  constructor(readonly prisma: PrismaService) {}

  async lockTags(
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

  async lockCategory(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "categories" WHERE "id" = ${id}::uuid FOR UPDATE
    `);
    return rows.length === 1;
  }

  async findTagByNormalizedName(
    name: string,
  ): Promise<{ readonly id: string } | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "tags" WHERE LOWER("name") = LOWER(${name}) LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async findCategoryByNormalizedName(
    name: string,
  ): Promise<{ readonly id: string } | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "categories" WHERE LOWER("name") = LOWER(${name}) LIMIT 1
    `);
    return rows[0] ?? null;
  }
}

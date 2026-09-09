import { Injectable } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import type {
  SearchDocument,
  SearchHit,
  SearchInput,
} from '../../domain/search.models';
import {
  normalizeSearchText,
  searchPlainText,
  searchSnippet,
} from '../../domain/policies/search-text.policy';

type DbClient = Prisma.TransactionClient | PrismaService;
interface DocumentRow {
  id: string;
  entity_id: string;
  kind: 'story' | 'chapter';
  title: string;
  slug: string;
  content: string;
  author_name: string;
  categories: string[];
  category_slugs: string[];
  tags: string[];
  tag_slugs: string[];
  story_id: string;
  story_slug: string;
  story_title: string;
  number: Prisma.Decimal | null;
  access_type: 'free' | 'paid';
  status: string;
  content_rating: string;
  release_year: number | null;
  is_featured: boolean;
  published_at: Date;
  view_count: bigint;
  follower_count: number;
  rating_average: Prisma.Decimal;
}

@Injectable()
export class SearchSourceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async documents(
    ids: readonly string[],
    tx: DbClient = this.prisma,
  ): Promise<SearchDocument[]> {
    if (!ids.length) return [];
    const rows = await tx.$queryRaw<DocumentRow[]>(Prisma.sql`
      SELECT * FROM search_public_documents WHERE id IN (${Prisma.join(ids)}) ORDER BY id
    `);
    return rows.map(mapDocument);
  }

  async batch(cursor: string | null, tx: DbClient): Promise<SearchDocument[]> {
    const rows = await tx.$queryRaw<DocumentRow[]>(Prisma.sql`
      SELECT * FROM search_public_documents WHERE id > ${cursor ?? ''} ORDER BY id LIMIT 100
    `);
    return rows.map(mapDocument);
  }

  async fallback(
    input: SearchInput,
  ): Promise<{ documents: SearchDocument[]; total: number }> {
    const where = filters(input);
    const q = normalizeSearchText(input.q);
    const vector = Prisma.sql`(
      setweight(to_tsvector('simple', search_normalize(title)), 'A') ||
      setweight(to_tsvector('simple', search_normalize(author_name)), 'B') ||
      setweight(to_tsvector('simple', search_normalize(array_to_string(categories || tags, ' '))), 'B') ||
      setweight(
        to_tsvector(
          'simple',
          search_normalize(
            CASE
              WHEN kind <> 'chapter' OR access_type = 'free'
                THEN content || ' ' || story_title
              ELSE story_title
            END,
          ),
        ),
        'C',
      )
    )`;
    const needle = Prisma.sql`plainto_tsquery('simple', ${q})`;
    // Parameterized expressions: filter values and queries never become SQL text.
    const match = q
      ? Prisma.sql`AND (${vector} @@ ${needle}
      OR search_normalize(title) % ${q} OR search_normalize(author_name) % ${q}
      OR search_normalize(title) LIKE ${`%${escapeLike(q)}%`} ESCAPE ${'\\'})`
      : Prisma.empty;
    const rank = q
      ? Prisma.sql`ts_rank_cd(${vector}, ${needle}) + similarity(search_normalize(title), ${q})`
      : Prisma.sql`0`;
    const order = {
      relevance: Prisma.sql`score DESC, published_at DESC`,
      newest: Prisma.sql`published_at DESC`,
      views: Prisma.sql`view_count DESC`,
      followers: Prisma.sql`follower_count DESC`,
      rating: Prisma.sql`rating_average DESC`,
    }[input.sort];
    return this.prisma.$transaction(
      async (tx) => {
        const counts = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT count(*) FROM search_public_documents WHERE ${where} ${match}
      `);
        const rows = await tx.$queryRaw<DocumentRow[]>(Prisma.sql`
        SELECT *, ${rank} AS score FROM search_public_documents WHERE ${where} ${match}
        ORDER BY ${order}, id ASC LIMIT ${input.pageSize} OFFSET ${(input.page - 1) * input.pageSize}
      `);
        return {
          documents: rows.map(mapDocument),
          total: Number(counts[0]?.count ?? 0),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async toHits(
    documents: readonly SearchDocument[],
    query: string,
    viewerId?: string,
  ): Promise<SearchHit[]> {
    const paidIds = documents
      .filter((doc) => doc.kind === 'chapter' && doc.accessType === 'paid')
      .map((doc) => doc.entityId);
    const entitlements =
      viewerId && paidIds.length
        ? await this.prisma.chapterEntitlement.findMany({
            where: {
              userId: viewerId,
              chapterId: { in: paidIds },
              status: 'ACTIVE',
              purchase: { status: 'COMPLETED' },
            },
            select: { chapterId: true },
          })
        : [];
    const owned = new Set(entitlements.map((row) => row.chapterId));
    return documents.map((doc) => ({
      id: doc.entityId,
      kind: doc.kind,
      title: doc.title,
      slug: doc.slug,
      snippet: searchSnippet(doc.content, query),
      authorName: doc.authorName,
      categories: doc.categories,
      tags: doc.tags,
      storyId: doc.storyId,
      storyTitle: doc.storyTitle,
      storySlug: doc.storySlug,
      number: doc.number,
      accessState:
        doc.accessType === 'free'
          ? 'FREE'
          : owned.has(doc.entityId)
            ? 'ENTITLED'
            : 'LOCKED',
    }));
  }
}

function filters(input: SearchInput): Prisma.Sql {
  const conditions = [Prisma.sql`kind = ${input.kind}`];
  if (input.category)
    conditions.push(Prisma.sql`${input.category} = ANY(category_slugs)`);
  if (input.tag) conditions.push(Prisma.sql`${input.tag} = ANY(tag_slugs)`);
  if (input.status) conditions.push(Prisma.sql`status = ${input.status}`);
  if (input.contentRating)
    conditions.push(Prisma.sql`content_rating = ${input.contentRating}`);
  if (input.storyId)
    conditions.push(Prisma.sql`story_id = ${input.storyId}::uuid`);
  if (input.yearFrom)
    conditions.push(Prisma.sql`release_year >= ${input.yearFrom}`);
  if (input.yearTo)
    conditions.push(Prisma.sql`release_year <= ${input.yearTo}`);
  if (input.featured !== undefined)
    conditions.push(Prisma.sql`is_featured = ${input.featured}`);
  return Prisma.join(conditions, ' AND ');
}

function mapDocument(row: DocumentRow): SearchDocument {
  return {
    id: row.id,
    entityId: row.entity_id,
    kind: row.kind,
    title: row.title,
    slug: row.slug,
    content: searchPlainText(row.content),
    authorName: row.author_name,
    categories: row.categories,
    categorySlugs: row.category_slugs,
    tags: row.tags,
    tagSlugs: row.tag_slugs,
    storyId: row.story_id,
    storySlug: row.story_slug,
    storyTitle: row.story_title,
    number: row.number === null ? null : Number(row.number),
    accessType: row.access_type,
    status: row.status,
    contentRating: row.content_rating,
    releaseYear: row.release_year,
    isFeatured: row.is_featured,
    publishedAt: row.published_at.getTime(),
    viewCount: Number(row.view_count),
    followerCount: row.follower_count,
    ratingAverage: Number(row.rating_average),
  };
}
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/gu, '\\$&');
}

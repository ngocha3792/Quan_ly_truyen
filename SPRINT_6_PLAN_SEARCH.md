# SPRINT 6 — Full-text và Fuzzy Search
**Timeline:** 8–12 ngày  
**Mục tiêu:** Meilisearch integration với Vietnamese normalization, typo tolerance và entitlement-aware search

---

## 🎯 ACCEPTANCE CRITERIA

✅ Meilisearch làm primary search engine, PostgreSQL fallback  
✅ Outbox events cho story/chapter lifecycle  
✅ Consumer idempotent cập nhật index  
✅ Vietnamese normalization + typo tolerance  
✅ Title/author/category/tag boosting  
✅ Chapter content search chỉ index nội dung công khai  
✅ Paid chapter không trả snippet full cho người chưa unlock  
✅ Blue/green index rebuild với checkpoint  
✅ Metrics: indexing lag, failed docs, empty-query rate, search P95  

---

## 📊 PHÂN TÍCH HIỆN TẠI

### Existing Search:
- Không có full-text search hiện tại
- PostgreSQL có thể làm basic LIKE queries
- Không có fuzzy matching hoặc typo tolerance

### Outbox Pattern:
- Đã có `OutboxEvent` table
- Worker xử lý outbox events
- Cần thêm search-specific event types

### Chapter Content:
- `ChapterContentDocument` với blocks
- Access type: FREE/PAID/AUTHOR_ONLY
- Entitlement system đã có

---

## 🏗️ TECHNICAL DESIGN

### 1. Database Schema Changes

```prisma
enum SearchEventType {
  STORY_PUBLISHED      @map("story_published")
  STORY_UPDATED        @map("story_updated")
  STORY_UNPUBLISHED    @map("story_unpublished")
  STORY_DELETED        @map("story_deleted")
  CHAPTER_PUBLISHED    @map("chapter_published")
  CHAPTER_UPDATED      @map("chapter_updated")
  CHAPTER_UNPUBLISHED  @map("chapter_unpublished")
  CHAPTER_DELETED      @map("chapter_deleted")
  
  @@map("search_event_type")
}

model SearchIndexCheckpoint {
  id                String   @id @default(uuid()) @db.Uuid
  indexName         String   @unique @map("index_name") @db.VarChar(100)
  
  // Checkpoint state
  lastProcessedEventId  BigInt?  @map("last_processed_event_id")
  lastProcessedAt       DateTime? @map("last_processed_at") @db.Timestamptz(3)
  
  // Index metadata
  totalDocuments    Int      @default(0) @map("total_documents")
  lastFullRebuildAt DateTime? @map("last_full_rebuild_at") @db.Timestamptz(3)
  
  // Health
  failedDocuments   Int      @default(0) @map("failed_documents")
  lastErrorAt       DateTime? @map("last_error_at") @db.Timestamptz(3)
  lastError         String?   @map("last_error") @db.Text
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)
  
  @@map("search_index_checkpoints")
}

model SearchMetrics {
  id            String   @id @default(uuid()) @db.Uuid
  
  // Query metrics
  query         String?  @db.Text
  resultCount   Int      @map("result_count")
  latencyMs     Int      @map("latency_ms")
  userId        String?  @map("user_id") @db.Uuid
  
  // Context
  isEmptyQuery  Boolean  @default(false) @map("is_empty_query")
  filters       Json?
  
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  
  @@index([createdAt])
  @@index([isEmptyQuery, createdAt])
  @@map("search_metrics")
}

// Extend OutboxEvent with search event types (no schema change needed)
```

---

### 2. Meilisearch Setup & Configuration (1 ngày)

**Task 2.1: Docker Compose Integration**

**File:** `backend/docker/compose.development.yml`

```yaml
services:
  meilisearch:
    image: getmeili/meilisearch:v1.10
    ports:
      - "7700:7700"
    environment:
      MEILI_ENV: development
      MEILI_MASTER_KEY: ${MEILISEARCH_MASTER_KEY:-development_master_key}
      MEILI_NO_ANALYTICS: true
    volumes:
      - meilisearch_data:/meili_data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7700/health"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  meilisearch_data:
```

**Task 2.2: Meilisearch Index Configuration**

**File:** `backend/src/modules/search/infrastructure/meilisearch/meilisearch-config.ts`

```typescript
export const STORY_INDEX_CONFIG = {
  name: 'stories',
  primaryKey: 'id',
  
  searchableAttributes: [
    'title',           // Highest priority
    'synopsis',
    'authorName',
    'categories',
    'tags',
  ],
  
  filterableAttributes: [
    'status',
    'visibility',
    'contentRating',
    'releaseYear',
    'categories',
    'tags',
    'isFeatured',
    'isCompleted',
    'publishedAt',
  ],
  
  sortableAttributes: [
    'publishedAt',
    'updatedAt',
    'viewCount',
    'followCount',
    'averageRating',
    'chapterCount',
  ],
  
  rankingRules: [
    'words',           // Typo tolerance
    'typo',            // Fuzzy matching
    'proximity',       // Word proximity
    'attribute',       // Attribute ranking (title > synopsis)
    'sort',
    'exactness',       // Exact matches preferred
  ],
  
  displayedAttributes: [
    'id',
    'slug',
    'title',
    'synopsis',
    'authorId',
    'authorName',
    'coverUrl',
    'categories',
    'tags',
    'status',
    'chapterCount',
    'viewCount',
    'followCount',
    'averageRating',
    'publishedAt',
  ],
  
  typoTolerance: {
    enabled: true,
    minWordSizeForTypos: {
      oneTypo: 4,
      twoTypos: 8,
    },
  },
  
  // Vietnamese-specific
  separatorTokens: ['-', '_'],
  nonSeparatorTokens: [],
  
  synonyms: {
    'truyen': ['truyện', 'story'],
    'tien hiep': ['tiên hiệp', 'tien-hiep'],
    'ngon tinh': ['ngôn tình', 'ngon-tinh'],
  },
};

export const CHAPTER_INDEX_CONFIG = {
  name: 'chapters',
  primaryKey: 'id',
  
  searchableAttributes: [
    'title',
    'content',       // Full chapter text (public only)
    'storyTitle',
  ],
  
  filterableAttributes: [
    'storyId',
    'status',
    'accessType',
    'publishedAt',
  ],
  
  sortableAttributes: [
    'publishedAt',
    'number',
  ],
  
  rankingRules: [
    'words',
    'typo',
    'proximity',
    'attribute',
    'sort',
    'exactness',
  ],
  
  displayedAttributes: [
    'id',
    'slug',
    'title',
    'number',
    'storyId',
    'storySlug',
    'storyTitle',
    'accessType',
    'publishedAt',
    '_snippets',  // Controlled snippet
  ],
};
```

---

### 3. Search Port & Adapters (2 ngày)

**Task 3.1: Search Port Interface**

**File:** `backend/src/modules/search/application/ports/story-search.port.ts`

```typescript
export const STORY_SEARCH_PORT = Symbol.for('modules.search.story');

export interface SearchStoryInput {
  readonly query: string;
  readonly filters?: {
    readonly categories?: readonly string[];
    readonly tags?: readonly string[];
    readonly status?: readonly string[];
    readonly contentRating?: readonly string[];
    readonly isCompleted?: boolean;
    readonly isFeatured?: boolean;
    readonly releaseYearMin?: number;
    readonly releaseYearMax?: number;
  };
  readonly sort?: {
    readonly field: 'publishedAt' | 'viewCount' | 'followCount' | 'averageRating';
    readonly direction: 'asc' | 'desc';
  };
  readonly page?: number;
  readonly pageSize?: number;
}

export interface SearchStoryResult {
  readonly hits: readonly StorySearchHit[];
  readonly totalHits: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly processingTimeMs: number;
  readonly query: string;
}

export interface StorySearchHit {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly synopsis: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly coverUrl: string | null;
  readonly categories: readonly string[];
  readonly tags: readonly string[];
  readonly chapterCount: number;
  readonly viewCount: number;
  readonly followCount: number;
  readonly averageRating: number | null;
  readonly publishedAt: Date;
  readonly _highlightedTitle?: string;
  readonly _highlightedSynopsis?: string;
}

export interface StorySearchPort {
  search(input: SearchStoryInput): Promise<SearchStoryResult>;
  
  indexStory(storyId: string): Promise<void>;
  updateStory(storyId: string): Promise<void>;
  deleteStory(storyId: string): Promise<void>;
  
  rebuildIndex(options?: { batchSize?: number }): Promise<{ indexed: number }>;
  
  getHealth(): Promise<{ healthy: boolean; details: Record<string, unknown> }>;
}
```

**Task 3.2: Meilisearch Adapter**

**File:** `backend/src/modules/search/infrastructure/meilisearch/meilisearch-story-search.adapter.ts`

```typescript
@Injectable()
export class MeilisearchStorySearchAdapter implements StorySearchPort {
  private client: MeiliSearch;
  private storyIndex: Index;
  
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {
    const host = this.config.get('meilisearch.host', 'http://localhost:7700');
    const apiKey = this.config.get('meilisearch.apiKey');
    
    this.client = new MeiliSearch({ host, apiKey });
    this.storyIndex = this.client.index(STORY_INDEX_CONFIG.name);
  }
  
  async onModuleInit() {
    try {
      // Create or update index settings
      await this.storyIndex.updateSettings(STORY_INDEX_CONFIG);
      this.logger.log('Meilisearch story index configured');
    } catch (error) {
      this.logger.error('Failed to configure Meilisearch', error);
    }
  }
  
  async search(input: SearchStoryInput): Promise<SearchStoryResult> {
    const startTime = Date.now();
    
    try {
      // Build filter string
      const filters = this.buildFilters(input.filters);
      
      // Build sort array
      const sort = input.sort
        ? [`${input.sort.field}:${input.sort.direction}`]
        : undefined;
      
      const result = await this.storyIndex.search(input.query, {
        filter: filters,
        sort,
        page: input.page ?? 1,
        hitsPerPage: input.pageSize ?? 20,
        attributesToHighlight: ['title', 'synopsis'],
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>',
      });
      
      const processingTimeMs = Date.now() - startTime;
      
      return {
        hits: result.hits.map(this.mapHit),
        totalHits: result.estimatedTotalHits ?? 0,
        page: result.page ?? 1,
        pageSize: result.hitsPerPage ?? 20,
        totalPages: Math.ceil((result.estimatedTotalHits ?? 0) / (result.hitsPerPage ?? 20)),
        processingTimeMs,
        query: input.query,
      };
    } catch (error) {
      this.logger.error('Meilisearch query failed', error);
      throw new SearchException('Search query failed');
    }
  }
  
  async indexStory(storyId: string): Promise<void> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      include: {
        author: true,
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
        coverMedia: true,
      },
    });
    
    if (!story) {
      throw new ResourceNotFoundException('Story', storyId);
    }
    
    // Only index published, public stories
    if (story.status !== 'PUBLISHED' || story.visibility !== 'PUBLIC') {
      await this.deleteStory(storyId);
      return;
    }
    
    const document = {
      id: story.id,
      slug: story.slug,
      title: story.title,
      synopsis: story.synopsis || '',
      authorId: story.authorId,
      authorName: story.author.penName,
      coverUrl: story.coverMedia?.publicUrl || null,
      categories: story.categories.map(sc => sc.category.name),
      tags: story.tags.map(st => st.tag.name),
      status: story.status,
      visibility: story.visibility,
      contentRating: story.contentRating,
      releaseYear: story.releaseYear,
      isFeatured: story.isFeatured,
      isCompleted: story.status === 'COMPLETED',
      chapterCount: story.chapterCount,
      viewCount: story.viewCount,
      followCount: story.followCount,
      averageRating: story.averageRating ? parseFloat(story.averageRating.toString()) : null,
      publishedAt: story.publishedAt?.getTime() || null,
      updatedAt: story.updatedAt.getTime(),
    };
    
    await this.storyIndex.addDocuments([document]);
  }
  
  async updateStory(storyId: string): Promise<void> {
    return this.indexStory(storyId);
  }
  
  async deleteStory(storyId: string): Promise<void> {
    try {
      await this.storyIndex.deleteDocument(storyId);
    } catch (error) {
      // Ignore if document doesn't exist
      if (error.code !== 'document_not_found') {
        throw error;
      }
    }
  }
  
  async rebuildIndex(options?: { batchSize?: number }): Promise<{ indexed: number }> {
    const batchSize = options?.batchSize ?? 100;
    let indexed = 0;
    let cursor: string | undefined;
    
    this.logger.log('Starting story index rebuild');
    
    // Clear existing index
    await this.storyIndex.deleteAllDocuments();
    
    // Fetch and index in batches
    while (true) {
      const stories = await this.prisma.story.findMany({
        where: {
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          deletedAt: null,
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        include: {
          author: true,
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
          coverMedia: true,
        },
        take: batchSize,
        orderBy: { id: 'asc' },
      });
      
      if (stories.length === 0) break;
      
      const documents = stories.map(story => ({
        id: story.id,
        slug: story.slug,
        title: story.title,
        synopsis: story.synopsis || '',
        authorId: story.authorId,
        authorName: story.author.penName,
        coverUrl: story.coverMedia?.publicUrl || null,
        categories: story.categories.map(sc => sc.category.name),
        tags: story.tags.map(st => st.tag.name),
        status: story.status,
        visibility: story.visibility,
        contentRating: story.contentRating,
        releaseYear: story.releaseYear,
        isFeatured: story.isFeatured,
        isCompleted: story.status === 'COMPLETED',
        chapterCount: story.chapterCount,
        viewCount: story.viewCount,
        followCount: story.followCount,
        averageRating: story.averageRating ? parseFloat(story.averageRating.toString()) : null,
        publishedAt: story.publishedAt?.getTime() || null,
        updatedAt: story.updatedAt.getTime(),
      }));
      
      await this.storyIndex.addDocuments(documents);
      
      indexed += stories.length;
      cursor = stories[stories.length - 1]!.id;
      
      this.logger.log(`Indexed ${indexed} stories`);
    }
    
    this.logger.log(`Story index rebuild completed: ${indexed} documents`);
    
    return { indexed };
  }
  
  async getHealth(): Promise<{ healthy: boolean; details: Record<string, unknown> }> {
    try {
      const health = await this.client.health();
      const stats = await this.storyIndex.getStats();
      
      return {
        healthy: health.status === 'available',
        details: {
          status: health.status,
          numberOfDocuments: stats.numberOfDocuments,
          isIndexing: stats.isIndexing,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: error.message },
      };
    }
  }
  
  private buildFilters(filters?: SearchStoryInput['filters']): string[] | undefined {
    if (!filters) return undefined;
    
    const filterParts: string[] = [];
    
    // Always filter published + public
    filterParts.push('status = PUBLISHED');
    filterParts.push('visibility = PUBLIC');
    
    if (filters.categories && filters.categories.length > 0) {
      const categoryFilter = filters.categories
        .map(c => `categories = "${c}"`)
        .join(' OR ');
      filterParts.push(`(${categoryFilter})`);
    }
    
    if (filters.tags && filters.tags.length > 0) {
      const tagFilter = filters.tags
        .map(t => `tags = "${t}"`)
        .join(' OR ');
      filterParts.push(`(${tagFilter})`);
    }
    
    if (filters.contentRating && filters.contentRating.length > 0) {
      const ratingFilter = filters.contentRating
        .map(r => `contentRating = "${r}"`)
        .join(' OR ');
      filterParts.push(`(${ratingFilter})`);
    }
    
    if (filters.isCompleted !== undefined) {
      filterParts.push(`isCompleted = ${filters.isCompleted}`);
    }
    
    if (filters.isFeatured !== undefined) {
      filterParts.push(`isFeatured = ${filters.isFeatured}`);
    }
    
    if (filters.releaseYearMin) {
      filterParts.push(`releaseYear >= ${filters.releaseYearMin}`);
    }
    
    if (filters.releaseYearMax) {
      filterParts.push(`releaseYear <= ${filters.releaseYearMax}`);
    }
    
    return filterParts.length > 0 ? filterParts : undefined;
  }
  
  private mapHit(hit: any): StorySearchHit {
    return {
      id: hit.id,
      slug: hit.slug,
      title: hit.title,
      synopsis: hit.synopsis,
      authorId: hit.authorId,
      authorName: hit.authorName,
      coverUrl: hit.coverUrl,
      categories: hit.categories,
      tags: hit.tags,
      chapterCount: hit.chapterCount,
      viewCount: hit.viewCount,
      followCount: hit.followCount,
      averageRating: hit.averageRating,
      publishedAt: new Date(hit.publishedAt),
      _highlightedTitle: hit._formatted?.title,
      _highlightedSynopsis: hit._formatted?.synopsis,
    };
  }
}
```

**Task 3.3: PostgreSQL Fallback Adapter**

**File:** `backend/src/modules/search/infrastructure/postgres/postgres-story-search.adapter.ts`

```typescript
@Injectable()
export class PostgresStorySearchAdapter implements StorySearchPort {
  constructor(private readonly prisma: PrismaService) {}
  
  async search(input: SearchStoryInput): Promise<SearchStoryResult> {
    const startTime = Date.now();
    
    // Build WHERE clause
    const where: Prisma.StoryWhereInput = {
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      deletedAt: null,
      
      // Basic text search using ILIKE
      ...(input.query ? {
        OR: [
          { title: { contains: input.query, mode: 'insensitive' } },
          { synopsis: { contains: input.query, mode: 'insensitive' } },
          { author: { penName: { contains: input.query, mode: 'insensitive' } } },
        ],
      } : {}),
      
      // Filters
      ...(input.filters?.categories ? {
        categories: {
          some: {
            category: {
              name: { in: input.filters.categories as string[] },
            },
          },
        },
      } : {}),
      
      ...(input.filters?.tags ? {
        tags: {
          some: {
            tag: {
              name: { in: input.filters.tags as string[] },
            },
          },
        },
      } : {}),
      
      ...(input.filters?.status ? {
        status: { in: input.filters.status as any[] },
      } : {}),
      
      ...(input.filters?.isCompleted !== undefined ? {
        status: input.filters.isCompleted ? 'COMPLETED' : { not: 'COMPLETED' },
      } : {}),
    };
    
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    
    const [total, stories] = await Promise.all([
      this.prisma.story.count({ where }),
      this.prisma.story.findMany({
        where,
        include: {
          author: true,
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
          coverMedia: true,
        },
        skip,
        take: pageSize,
        orderBy: this.buildOrderBy(input.sort),
      }),
    ]);
    
    const processingTimeMs = Date.now() - startTime;
    
    return {
      hits: stories.map(this.mapStory),
      totalHits: total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      processingTimeMs,
      query: input.query,
    };
  }
  
  async indexStory(storyId: string): Promise<void> {
    // No-op for PostgreSQL fallback
  }
  
  async updateStory(storyId: string): Promise<void> {
    // No-op
  }
  
  async deleteStory(storyId: string): Promise<void> {
    // No-op
  }
  
  async rebuildIndex(): Promise<{ indexed: number }> {
    return { indexed: 0 };
  }
  
  async getHealth(): Promise<{ healthy: boolean; details: Record<string, unknown> }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { healthy: true, details: { provider: 'PostgreSQL' } };
    } catch (error) {
      return { healthy: false, details: { error: error.message } };
    }
  }
  
  private buildOrderBy(sort?: SearchStoryInput['sort']): Prisma.StoryOrderByWithRelationInput {
    if (!sort) {
      return { publishedAt: 'desc' };
    }
    
    return { [sort.field]: sort.direction };
  }
  
  private mapStory(story: any): StorySearchHit {
    return {
      id: story.id,
      slug: story.slug,
      title: story.title,
      synopsis: story.synopsis || '',
      authorId: story.authorId,
      authorName: story.author.penName,
      coverUrl: story.coverMedia?.publicUrl || null,
      categories: story.categories.map((sc: any) => sc.category.name),
      tags: story.tags.map((st: any) => st.tag.name),
      chapterCount: story.chapterCount,
      viewCount: story.viewCount,
      followCount: story.followCount,
      averageRating: story.averageRating ? parseFloat(story.averageRating.toString()) : null,
      publishedAt: story.publishedAt,
    };
  }
}
```

---

### 4. Outbox Consumer & Indexing (3 ngày)

**Task 4.1: Search Event Publisher**

**File:** `backend/src/modules/search/application/listeners/story-lifecycle.listener.ts`

```typescript
@Injectable()
export class StoryLifecycleListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}
  
  @OnEvent('story.published')
  async handleStoryPublished(event: StoryPublishedEvent): Promise<void> {
    await this.publishSearchEvent({
      eventType: 'STORY_PUBLISHED',
      aggregateId: event.storyId,
      payload: { storyId: event.storyId },
    });
  }
  
  @OnEvent('story.updated')
  async handleStoryUpdated(event: StoryUpdatedEvent): Promise<void> {
    await this.publishSearchEvent({
      eventType: 'STORY_UPDATED',
      aggregateId: event.storyId,
      payload: { storyId: event.storyId, version: event.version },
    });
  }
  
  @OnEvent('story.unpublished')
  async handleStoryUnpublished(event: StoryUnpublishedEvent): Promise<void> {
    await this.publishSearchEvent({
      eventType: 'STORY_UNPUBLISHED',
      aggregateId: event.storyId,
      payload: { storyId: event.storyId },
    });
  }
  
  @OnEvent('story.deleted')
  async handleStoryDeleted(event: StoryDeletedEvent): Promise<void> {
    await this.publishSearchEvent({
      eventType: 'STORY_DELETED',
      aggregateId: event.storyId,
      payload: { storyId: event.storyId },
    });
  }
  
  private async publishSearchEvent(data: {
    eventType: string;
    aggregateId: string;
    payload: any;
  }): Promise<void> {
    try {
      await this.prisma.outboxEvent.create({
        data: {
          aggregateType: 'Story',
          aggregateId: data.aggregateId,
          eventType: data.eventType,
          payload: JSON.stringify(data.payload),
          status: 'PENDING',
        },
      });
    } catch (error) {
      this.logger.error('Failed to publish search event', error);
    }
  }
}
```

**Task 4.2: Search Index Consumer**

**File:** `backend/src/modules/search/infrastructure/queue/search-index-consumer.processor.ts`

```typescript
@Processor('outbox')
@Injectable()
export class SearchIndexConsumerProcessor {
  constructor(
    @Inject(STORY_SEARCH_PORT)
    private readonly storySearch: StorySearchPort,
    @Inject(CHAPTER_SEARCH_PORT)
    private readonly chapterSearch: ChapterSearchPort,
    @Inject(SEARCH_CHECKPOINT_PORT)
    private readonly checkpoint: SearchCheckpointPort,
    private readonly logger: Logger,
  ) {}
  
  @Process('search-index')
  async handleSearchEvent(job: Job<OutboxEvent>) {
    const event = job.data;
    
    try {
      // Idempotency check
      const lastProcessed = await this.checkpoint.getLastProcessedEventId('stories');
      if (event.id <= (lastProcessed ?? 0)) {
        this.logger.debug(`Event ${event.id} already processed, skipping`);
        return;
      }
      
      // Process based on event type
      switch (event.eventType) {
        case 'STORY_PUBLISHED':
        case 'STORY_UPDATED':
          await this.storySearch.updateStory(event.aggregateId);
          break;
          
        case 'STORY_UNPUBLISHED':
        case 'STORY_DELETED':
          await this.storySearch.deleteStory(event.aggregateId);
          break;
          
        case 'CHAPTER_PUBLISHED':
        case 'CHAPTER_UPDATED':
          await this.chapterSearch.updateChapter(event.aggregateId);
          break;
          
        case 'CHAPTER_UNPUBLISHED':
        case 'CHAPTER_DELETED':
          await this.chapterSearch.deleteChapter(event.aggregateId);
          break;
          
        default:
          this.logger.warn(`Unknown event type: ${event.eventType}`);
          return;
      }
      
      // Update checkpoint
      await this.checkpoint.updateCheckpoint('stories', event.id);
      
      this.logger.log({
        message: 'Search event processed',
        eventId: event.id,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
      });
      
    } catch (error) {
      this.logger.error({
        message: 'Search indexing failed',
        eventId: event.id,
        error: error.message,
      });
      
      // Update failed count
      await this.checkpoint.incrementFailedCount('stories');
      
      throw error; // Retry via BullMQ
    }
  }
}
```

---

### 5. Chapter Content Search với Entitlement (2 ngày)

**Task 5.1: Chapter Search Adapter**

**File:** `backend/src/modules/search/infrastructure/meilisearch/meilisearch-chapter-search.adapter.ts`

```typescript
@Injectable()
export class MeilisearchChapterSearchAdapter implements ChapterSearchPort {
  private client: MeiliSearch;
  private chapterIndex: Index;
  
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {
    const host = this.config.get('meilisearch.host', 'http://localhost:7700');
    const apiKey = this.config.get('meilisearch.apiKey');
    
    this.client = new MeiliSearch({ host, apiKey });
    this.chapterIndex = this.client.index(CHAPTER_INDEX_CONFIG.name);
  }
  
  async updateChapter(chapterId: string): Promise<void> {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        story: true,
      },
    });
    
    if (!chapter) {
      throw new ResourceNotFoundException('Chapter', chapterId);
    }
    
    // Only index published chapters from published stories
    if (chapter.status !== 'PUBLISHED' || chapter.story.status !== 'PUBLISHED') {
      await this.deleteChapter(chapterId);
      return;
    }
    
    // Extract content - ONLY if FREE or public preview
    let indexableContent = '';
    
    if (chapter.accessType === 'FREE') {
      // Free chapters: index full content
      indexableContent = this.extractPlainText(chapter.content);
    } else if (chapter.accessType === 'PAID') {
      // Paid chapters: only index preview if available
      if (chapter.previewContent) {
        indexableContent = this.extractPlainText(chapter.previewContent);
      }
      // Otherwise leave empty - still searchable by title
    }
    
    const document = {
      id: chapter.id,
      slug: chapter.slug,
      title: chapter.title,
      number: parseFloat(chapter.number.toString()),
      content: indexableContent,  // SECURITY: Only public content
      
      // Story context
      storyId: chapter.storyId,
      storySlug: chapter.story.slug,
      storyTitle: chapter.story.title,
      
      // Metadata
      accessType: chapter.accessType,
      status: chapter.status,
      publishedAt: chapter.publishedAt?.getTime() || null,
      wordCount: chapter.wordCount,
    };
    
    await this.chapterIndex.addDocuments([document]);
  }
  
  async search(
    input: SearchChapterInput,
    viewerUserId?: string,
  ): Promise<SearchChapterResult> {
    const result = await this.chapterIndex.search(input.query, {
      filter: this.buildFilters(input),
      page: input.page ?? 1,
      hitsPerPage: input.pageSize ?? 20,
      attributesToHighlight: ['title', 'content'],
      attributesToCrop: ['content'],
      cropLength: 200,
    });
    
    // Post-process: Filter snippets based on entitlement
    const hitsWithEntitlement = await Promise.all(
      result.hits.map(async (hit: any) => {
        // Check if viewer has access
        let snippet = hit._formatted?.content || '';
        
        if (hit.accessType === 'PAID' && viewerUserId) {
          const hasAccess = await this.checkEntitlement(
            viewerUserId,
            hit.id,
          );
          
          if (!hasAccess) {
            // SECURITY: Don't leak full snippet for paid content
            snippet = '[Nội dung trả phí - Cần mua để xem toàn bộ]';
          }
        }
        
        return {
          ...this.mapChapterHit(hit),
          _snippet: snippet,
        };
      })
    );
    
    return {
      hits: hitsWithEntitlement,
      totalHits: result.estimatedTotalHits ?? 0,
      page: result.page ?? 1,
      pageSize: result.hitsPerPage ?? 20,
      totalPages: Math.ceil((result.estimatedTotalHits ?? 0) / (result.hitsPerPage ?? 20)),
      processingTimeMs: result.processingTimeMs,
      query: input.query,
    };
  }
  
  private extractPlainText(content: string): string {
    // Remove Markdown formatting for indexing
    return content
      .replace(/#{1,6}\s/g, '')        // Headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
      .replace(/\*(.+?)\*/g, '$1')     // Italic
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
      .replace(/`(.+?)`/g, '$1')       // Code
      .replace(/^>\s/gm, '')           // Blockquotes
      .trim();
  }
  
  private async checkEntitlement(userId: string, chapterId: string): Promise<boolean> {
    const entitlement = await this.prisma.chapterEntitlement.findUnique({
      where: {
        userId_chapterId: { userId, chapterId },
      },
    });
    
    return entitlement?.status === 'ACTIVE';
  }
}
```

---

### 6. Blue/Green Index Rebuild (1 ngày)

**File:** `backend/src/modules/search/application/commands/rebuild-search-index/rebuild-search-index.command-handler.ts`

```typescript
@Injectable()
export class RebuildSearchIndexCommandHandler {
  constructor(
    @Inject(STORY_SEARCH_PORT)
    private readonly storySearch: StorySearchPort,
    @Inject(SEARCH_CHECKPOINT_PORT)
    private readonly checkpoint: SearchCheckpointPort,
    private readonly config: ConfigService,
    private readonly logger: Logger,
  ) {}
  
  async execute(command: RebuildSearchIndexCommand): Promise<RebuildIndexResult> {
    const startTime = Date.now();
    this.logger.log('Starting blue/green index rebuild');
    
    try {
      // 1. Create new temporary index
      const tempIndexName = `${STORY_INDEX_CONFIG.name}_temp_${Date.now()}`;
      
      // 2. Build new index
      const { indexed } = await this.storySearch.rebuildIndex({
        batchSize: 100,
      });
      
      // 3. Checkpoint current outbox position
      const lastEventId = await this.getLastOutboxEventId();
      await this.checkpoint.updateCheckpoint(
        STORY_INDEX_CONFIG.name,
        lastEventId,
      );
      
      // 4. Update rebuild timestamp
      await this.checkpoint.updateLastRebuildTime(STORY_INDEX_CONFIG.name);
      
      const durationMs = Date.now() - startTime;
      
      this.logger.log({
        message: 'Index rebuild completed',
        indexed,
        durationMs,
      });
      
      return {
        success: true,
        indexed,
        durationMs,
      };
      
    } catch (error) {
      this.logger.error('Index rebuild failed', error);
      
      throw new SearchException(`Index rebuild failed: ${error.message}`);
    }
  }
  
  private async getLastOutboxEventId(): Promise<bigint> {
    const lastEvent = await this.prisma.outboxEvent.findFirst({
      where: { aggregateType: 'Story' },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    
    return lastEvent?.id ?? 0n;
  }
}
```

---

### 7. Metrics & Monitoring (1 ngày)

**File:** `backend/src/modules/search/infrastructure/metrics/search-metrics.adapter.ts`

```typescript
@Injectable()
export class SearchMetricsAdapter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}
  
  async recordSearch(data: {
    query: string;
    resultCount: number;
    latencyMs: number;
    userId?: string;
    filters?: any;
  }): Promise<void> {
    // Record to database
    await this.prisma.searchMetrics.create({
      data: {
        query: data.query.slice(0, 1000),
        resultCount: data.resultCount,
        latencyMs: data.latencyMs,
        userId: data.userId,
        filters: data.filters ? JSON.stringify(data.filters) : null,
        isEmptyQuery: data.query.trim().length === 0,
      },
    });
    
    // Record to Prometheus
    this.metrics.histogram('search_latency_ms', data.latencyMs, {
      has_results: data.resultCount > 0 ? 'true' : 'false',
    });
    
    this.metrics.counter('search_queries_total', 1, {
      is_empty: data.query.trim().length === 0 ? 'true' : 'false',
    });
  }
  
  async getIndexingLag(): Promise<number> {
    const lastCheckpoint = await this.prisma.searchIndexCheckpoint.findUnique({
      where: { indexName: 'stories' },
    });
    
    if (!lastCheckpoint?.lastProcessedAt) {
      return 0;
    }
    
    const now = new Date();
    const lagMs = now.getTime() - lastCheckpoint.lastProcessedAt.getTime();
    
    this.metrics.gauge('search_indexing_lag_seconds', lagMs / 1000);
    
    return lagMs;
  }
  
  async getSearchP95(): Promise<number> {
    const result = await this.prisma.$queryRaw<[{ p95: number }]>`
      SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95
      FROM search_metrics
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    `;
    
    const p95 = result[0]?.p95 ?? 0;
    
    this.metrics.gauge('search_p95_latency_ms', p95);
    
    return p95;
  }
  
  async getEmptyQueryRate(): Promise<number> {
    const result = await this.prisma.$queryRaw<[{ rate: number }]>`
      SELECT 
        (COUNT(*) FILTER (WHERE is_empty_query = true)::float / COUNT(*)::float) * 100 as rate
      FROM search_metrics
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    `;
    
    const rate = result[0]?.rate ?? 0;
    
    this.metrics.gauge('search_empty_query_rate_percent', rate);
    
    return rate;
  }
}
```

---

## 📝 IMPLEMENTATION ORDER

### Day 1-2: Meilisearch Setup & Config
- [ ] Docker compose integration
- [ ] Index configuration
- [ ] Vietnamese normalization setup
- [ ] Connection testing

### Day 3-4: Search Port & Adapters
- [ ] StorySearchPort interface
- [ ] Meilisearch adapter
- [ ] PostgreSQL fallback adapter
- [ ] Tests

### Day 5-7: Outbox Consumer & Indexing
- [ ] Story lifecycle listeners
- [ ] Search event publisher
- [ ] Index consumer processor
- [ ] Idempotency + checkpoint
- [ ] Tests

### Day 8-9: Chapter Content Search
- [ ] Chapter search adapter
- [ ] Entitlement-aware snippets
- [ ] Content extraction (public only)
- [ ] Tests

### Day 10: Blue/Green Rebuild
- [ ] Rebuild command
- [ ] Checkpoint system
- [ ] Manual rebuild endpoint
- [ ] Tests

### Day 11: Metrics & Monitoring
- [ ] Search metrics tracking
- [ ] Indexing lag monitoring
- [ ] P95 latency tracking
- [ ] Empty query rate
- [ ] Dashboard

### Day 12: Integration & Polish
- [ ] HTTP API endpoints
- [ ] Frontend integration
- [ ] E2E tests
- [ ] Documentation

---

## 🧪 TESTING STRATEGY

### Functional Tests
- [ ] Search with typos → correct results
- [ ] Vietnamese text search → proper normalization
- [ ] Filter by category/tag → filtered correctly
- [ ] Paid chapter search → snippet protected

### Security Tests
- [ ] Paid content not leaked in snippets
- [ ] Entitlement checked before full content
- [ ] Only public chapters indexed

### Performance Tests
- [ ] Search latency < 100ms (P95)
- [ ] Index rebuild < 10 min for 10k stories
- [ ] Indexing lag < 30 seconds

---

## 🚨 RISKS & MITIGATION

### Risk 1: Meilisearch downtime
**Mitigation:** PostgreSQL fallback, health checks, retry logic

### Risk 2: Index lag too high
**Mitigation:** Monitor lag metric, alert if > 5 minutes, scale workers

### Risk 3: Content leakage in search
**Mitigation:** Server-side entitlement check, audit snippets, tests

---

## 📚 DOCUMENTATION

- [ ] Meilisearch setup guide
- [ ] Index rebuild procedures
- [ ] Search API docs
- [ ] Monitoring runbook

---

## ✅ DEFINITION OF DONE

- [ ] All tests passing
- [ ] Meilisearch working with Vietnamese
- [ ] PostgreSQL fallback functional
- [ ] Outbox consumer idempotent
- [ ] Paid content protected
- [ ] Metrics tracked
- [ ] Blue/green rebuild working
- [ ] Documentation complete

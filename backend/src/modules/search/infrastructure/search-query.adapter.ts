import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import searchConfig from '@/config/search.config';
import { PrismaService } from '@/infrastructure/database';
import {
  SEARCH_ENGINE_PORT,
  type SearchEnginePort,
  type SearchQueryPort,
} from '../application/ports/search.port';
import type {
  SearchDocument,
  SearchInput,
  SearchResult,
} from '../domain/search.models';
import { SearchSourceRepository } from './persistence/search-source.repository';
import { SearchMetricsAdapter } from './metrics/search-metrics.adapter';
import { sourceHash } from './meilisearch/search-index.settings';

@Injectable()
export class SearchQueryAdapter implements SearchQueryPort {
  private readonly logger = new Logger(SearchQueryAdapter.name);
  private unavailableUntil = 0;
  constructor(
    @Inject(searchConfig.KEY)
    private readonly config: ConfigType<typeof searchConfig>,
    @Inject(SEARCH_ENGINE_PORT) private readonly meili: SearchEnginePort,
    private readonly source: SearchSourceRepository,
    private readonly prisma: PrismaService,
    private readonly metrics: SearchMetricsAdapter,
  ) {}
  async search(input: SearchInput, viewerId?: string): Promise<SearchResult> {
    const start = performance.now();
    let engine: SearchResult['engine'] = 'postgres';
    let found: { documents: SearchDocument[]; total: number } | undefined;
    if (this.config.enabled && this.unavailableUntil <= Date.now()) {
      try {
        const checkpoint = await this.prisma.searchIndexCheckpoint.findUnique({
          where: { indexName: this.config.index },
        });
        if (checkpoint?.activeIndex) {
          const result = await this.meili.search(checkpoint.activeIndex, input);
          const current = await this.source.documents(
            result.hits.map((hit) => hit.id),
          );
          const byId = new Map(current.map((doc) => [doc.id, doc]));
          // Index lag must never disclose stale private text, titles or snippets.
          const valid = result.hits.every((hit) => {
            const document = byId.get(hit.id);
            return document && sourceHash(document) === hit.sourceHash;
          });
          if (valid) {
            found = {
              documents: result.hits.map((hit) => byId.get(hit.id)!),
              total: result.total,
            };
            engine = 'meilisearch';
          }
        }
      } catch {
        this.unavailableUntil = Date.now() + 10000;
        this.logger.warn({
          event: 'search.postgres_fallback',
          reason: 'engine_unavailable',
        });
      }
    }
    found ??= await this.source.fallback(input);
    const hits = await this.source.toHits(found.documents, input.q, viewerId);
    const processingTimeMs = Math.round(performance.now() - start);
    this.metrics.query(engine, !input.q, hits.length, processingTimeMs);
    return {
      hits,
      totalHits: found.total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.ceil(found.total / input.pageSize),
      query: input.q,
      engine,
      processingTimeMs,
    };
  }
  async filters() {
    const [categories, tags] = await Promise.all([
      this.prisma.category.findMany({
        where: { isActive: true },
        select: { name: true, slug: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
      this.prisma.tag.findMany({
        select: { name: true, slug: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
    ]);
    return { categories, tags };
  }
}

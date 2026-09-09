import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import searchConfig from '@/config/search.config';
import type { SearchEnginePort } from '../../application/ports/search.port';
import type { SearchDocument, SearchInput } from '../../domain/search.models';
import { normalizeSearchText } from '../../domain/policies/search-text.policy';
import {
  meiliFilters,
  SEARCH_SETTINGS,
  toIndexDocument,
} from './search-index.settings';

/** REST adapter keeps credentials server-side; every write waits for task success. */
@Injectable()
export class MeilisearchAdapter implements SearchEnginePort {
  constructor(
    @Inject(searchConfig.KEY)
    private readonly config: ConfigType<typeof searchConfig>,
  ) {}

  async search(index: string, input: SearchInput) {
    const sorts: Record<string, string> = {
      newest: 'publishedAt:desc',
      views: 'viewCount:desc',
      followers: 'followerCount:desc',
      rating: 'ratingAverage:desc',
    };
    const value = await this.request(`/indexes/${index}/search`, 'POST', {
      q: normalizeSearchText(input.q),
      filter: meiliFilters(input),
      page: input.page,
      hitsPerPage: input.pageSize,
      attributesToRetrieve: ['id', 'sourceHash'],
      ...(sorts[input.sort] ? { sort: [sorts[input.sort]] } : {}),
    });
    if (!isRecord(value) || !Array.isArray(value.hits))
      throw new Error('Invalid search response');
    const totalCandidate = value.totalHits ?? value.estimatedTotalHits;
    if (!Number.isSafeInteger(totalCandidate))
      throw new Error('Invalid search response total');
    const hits = value.hits.map((hit: unknown) => {
      if (
        !isRecord(hit) ||
        typeof hit.id !== 'string' ||
        typeof hit.sourceHash !== 'string'
      )
        throw new Error('Invalid search hit');
      return { id: hit.id, sourceHash: hit.sourceHash };
    });
    return { hits, total: totalCandidate as number };
  }

  async configure(index: string): Promise<void> {
    // PUT documents/settings creates an index when absent; persist primary key first.
    const existing = await this.request(
      `/indexes/${index}`,
      'GET',
      undefined,
      true,
    );
    if (existing === null)
      await this.task('/indexes', 'POST', { uid: index, primaryKey: 'id' });
    await this.task(`/indexes/${index}/settings`, 'PATCH', SEARCH_SETTINGS);
  }
  async upsert(
    index: string,
    documents: readonly SearchDocument[],
  ): Promise<void> {
    if (documents.length)
      await this.task(
        `/indexes/${index}/documents`,
        'POST',
        documents.map(toIndexDocument),
      );
  }
  async remove(index: string, ids: readonly string[]): Promise<void> {
    if (ids.length)
      await this.task(`/indexes/${index}/documents/delete-batch`, 'POST', ids);
  }
  async drop(index: string): Promise<void> {
    if (await this.request(`/indexes/${index}`, 'GET', undefined, true))
      await this.task(`/indexes/${index}`, 'DELETE');
  }
  private async task(
    path: string,
    method: string,
    data?: unknown,
  ): Promise<void> {
    const result = await this.request(path, method, data);
    if (!isRecord(result) || !Number.isSafeInteger(result.taskUid))
      throw new Error('Invalid Meilisearch task');
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const task = await this.request(
        `/tasks/${String(result.taskUid)}`,
        'GET',
      );
      if (isRecord(task) && task.status === 'succeeded') return;
      if (
        isRecord(task) &&
        ['failed', 'canceled'].includes(String(task.status))
      )
        throw new Error('Meilisearch indexing task failed');
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(
      'Meilisearch task timed out; checkpoint retained for retry',
    );
  }
  private async request(
    path: string,
    method: string,
    data?: unknown,
    allowMissing = false,
  ): Promise<unknown> {
    const response = await fetch(
      `${this.config.host.replace(/\/$/u, '')}${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
        signal: AbortSignal.timeout(path.endsWith('/search') ? 1000 : 5000),
      },
    );
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new Error(`Meilisearch HTTP ${response.status}`);
    return response.json();
  }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

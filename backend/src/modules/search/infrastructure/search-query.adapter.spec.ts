import { SearchQueryAdapter } from './search-query.adapter';
import { sourceHash } from './meilisearch/search-index.settings';
import type { SearchDocument, SearchInput } from '../domain/search.models';

const document: SearchDocument = {
  id: 'chapter_11111111-1111-4111-8111-111111111111',
  entityId: '11111111-1111-4111-8111-111111111111',
  kind: 'chapter',
  title: 'Chương một',
  slug: 'chuong-mot',
  content: 'Chỉ phần xem trước',
  authorName: 'Tác giả',
  categories: [],
  categorySlugs: [],
  tags: [],
  tagSlugs: [],
  storyId: '22222222-2222-4222-8222-222222222222',
  storySlug: 'truyen',
  storyTitle: 'Truyện',
  number: 1,
  accessType: 'paid',
  status: 'published',
  contentRating: 'teen',
  releaseYear: 2026,
  isFeatured: false,
  publishedAt: 1000,
  viewCount: 0,
  followerCount: 0,
  ratingAverage: 0,
};
const input: SearchInput = {
  q: 'chuong',
  kind: 'chapter',
  page: 1,
  pageSize: 20,
  sort: 'relevance',
};

describe('SearchQueryAdapter source validation', () => {
  function setup() {
    const engine = {
      search: jest.fn().mockResolvedValue({
        hits: [{ id: document.id, sourceHash: sourceHash(document) }],
        total: 1,
      }),
    };
    const source = {
      documents: jest.fn().mockResolvedValue([document]),
      fallback: jest.fn().mockResolvedValue({ documents: [], total: 0 }),
      toHits: jest.fn().mockResolvedValue([]),
    };
    const prisma = {
      searchIndexCheckpoint: {
        findUnique: jest.fn().mockResolvedValue({ activeIndex: 'search_blue' }),
      },
    };
    const metrics = { query: jest.fn() };
    const adapter = new SearchQueryAdapter(
      {
        enabled: true,
        host: 'http://engine.test',
        apiKey: 'test',
        index: 'search',
      },
      engine as never,
      source as never,
      prisma as never,
      metrics as never,
    );
    return { adapter, engine, source };
  }
  it('preserves primary ranking but hydrates snippets from PostgreSQL', async () => {
    const { adapter, source } = setup();
    expect((await adapter.search(input)).engine).toBe('meilisearch');
    expect(source.toHits).toHaveBeenCalledWith([document], input.q, undefined);
    expect(source.fallback).not.toHaveBeenCalled();
  });
  it('rejects a stale free-content match after the chapter becomes paid', async () => {
    const { adapter, engine, source } = setup();
    engine.search.mockResolvedValue({
      hits: [
        {
          id: document.id,
          sourceHash: sourceHash({
            ...document,
            accessType: 'free',
            content: 'PRIVATE-CONTENT-SECRET',
          }),
        },
      ],
      total: 1,
    });
    const result = await adapter.search({
      ...input,
      q: 'PRIVATE-CONTENT-SECRET',
    });
    expect(result.engine).toBe('postgres');
    expect(result.hits).toEqual([]);
    expect(source.fallback).toHaveBeenCalled();
  });
  it('does not return deleted or hidden documents from a stale index', async () => {
    const { adapter, source } = setup();
    source.documents.mockResolvedValue([]);
    expect((await adapter.search(input)).engine).toBe('postgres');
  });
  it('opens a short circuit on failure and uses fallback without repeatedly waiting for timeouts', async () => {
    const { adapter, engine, source } = setup();
    engine.search.mockRejectedValue(new Error('offline'));
    await adapter.search(input);
    await adapter.search(input);
    expect(engine.search).toHaveBeenCalledTimes(1);
    expect(source.fallback).toHaveBeenCalledTimes(2);
  });
});

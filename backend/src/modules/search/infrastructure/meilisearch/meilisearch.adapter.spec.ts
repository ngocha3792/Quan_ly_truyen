import { MeilisearchAdapter } from './meilisearch.adapter';
import { meiliFilters } from './search-index.settings';

describe('Meilisearch REST contract', () => {
  const adapter = new MeilisearchAdapter({
    enabled: true,
    host: 'http://engine.test',
    apiKey: 'private-key',
    index: 'search',
  });
  afterEach(() => jest.restoreAllMocks());
  const json = (body: object) =>
    new Response(JSON.stringify(body), { status: 200 });
  it('uses exact paginated totalHits and sends Vietnamese normalized text', async () => {
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(
      json({
        hits: [{ id: 'story_test', sourceHash: 'abc' }],
        totalHits: 23,
      }),
    );
    const result = await adapter.search('live', {
      q: 'Đấu phá',
      kind: 'story',
      sort: 'relevance',
      page: 2,
      pageSize: 20,
    });
    expect(result.total).toBe(23);
    const init = fetcher.mock.calls[0]?.[1];
    if (typeof init?.body !== 'string')
      throw new Error('Expected JSON request body');
    expect(JSON.parse(init.body)).toMatchObject({
      q: 'dau pha',
      page: 2,
      hitsPerPage: 20,
      attributesToRetrieve: ['id', 'sourceHash'],
    });
  });
  it('accepts the estimatedTotalHits field returned by Meilisearch pagination', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(json({ hits: [], estimatedTotalHits: 7 }));
    await expect(
      adapter.search('live', {
        q: '',
        kind: 'story',
        sort: 'relevance',
        page: 1,
        pageSize: 20,
      }),
    ).resolves.toMatchObject({ total: 7 });
  });
  it('does not consider an accepted asynchronous deletion complete until the task succeeds', async () => {
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json({ taskUid: 10 }))
      .mockResolvedValueOnce(json({ status: 'failed' }));
    await expect(adapter.remove('live', ['story_test'])).rejects.toThrow(
      'indexing task failed',
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('escapes filter literals instead of concatenating query syntax', () => {
    const result = meiliFilters({
      q: '',
      kind: 'chapter',
      sort: 'relevance',
      page: 1,
      pageSize: 20,
      category: 'a" OR kind = "story',
    });
    expect(result[0]).toBe('kind = "chapter"');
    expect(result[1]).toBe('categorySlugs = "a\\" OR kind = \\"story"');
  });
});

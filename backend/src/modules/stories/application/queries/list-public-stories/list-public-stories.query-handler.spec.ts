import { InvalidStoryFieldException } from '../../../domain';

import { ListPublicStoriesQuery } from './list-public-stories.query';
import { ListPublicStoriesQueryHandler } from './list-public-stories.query-handler';

describe('ListPublicStoriesQueryHandler', () => {
  let persistence: { listPublic: jest.Mock };
  let handler: ListPublicStoriesQueryHandler;

  beforeEach(() => {
    persistence = { listPublic: jest.fn() };
    handler = new ListPublicStoriesQueryHandler(persistence as never);
  });

  it('normalize search và genre trước khi query persistence', async () => {
    persistence.listPublic.mockResolvedValue({
      items: [],
      pagination: { page: 2, pageSize: 12, totalItems: 0, totalPages: 0 },
    });

    await handler.execute(
      new ListPublicStoriesQuery(
        '  kiếm tiên  ',
        '  Tien-Hiep  ',
        'ongoing',
        'latest',
        2020,
        2026,
        2,
        12,
      ),
    );

    expect(persistence.listPublic).toHaveBeenCalledWith({
      q: 'kiếm tiên',
      genre: 'tien-hiep',
      status: 'ongoing',
      sort: 'latest',
      yearFrom: 2020,
      yearTo: 2026,
      page: 2,
      pageSize: 12,
    });
  });

  it('reject year range đảo ngược trước khi query database', async () => {
    await expect(
      handler.execute(
        new ListPublicStoriesQuery(
          undefined,
          undefined,
          undefined,
          'latest',
          2026,
          2020,
          1,
          20,
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidStoryFieldException);

    expect(persistence.listPublic).not.toHaveBeenCalled();
  });
});

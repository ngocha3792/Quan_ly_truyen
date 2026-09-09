import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SearchRequest } from './search.request';

describe('SearchRequest boundary', () => {
  it('coerces pagination and false filters without dropping false', () => {
    const request = plainToInstance(SearchRequest, {
      q: 'đấu phá',
      page: '2',
      featured: 'false',
    });
    expect(validateSync(request)).toEqual([]);
    expect(request).toMatchObject({ page: 2, pageSize: 20, featured: false });
  });
  it.each([
    { page: '-1' },
    { pageSize: '999' },
    { q: 'a'.repeat(201) },
    { status: 'draft' },
    { kind: 'users' },
    { featured: 'yes' },
  ])('rejects malformed or private query values %j', (input) => {
    expect(
      validateSync(plainToInstance(SearchRequest, input)).length,
    ).toBeGreaterThan(0);
  });
  it('rejects client-supplied engine filters', () => {
    expect(
      validateSync(
        plainToInstance(SearchRequest, { filter: 'visibility = private' }),
        { whitelist: true, forbidNonWhitelisted: true },
      ).length,
    ).toBeGreaterThan(0);
  });
});

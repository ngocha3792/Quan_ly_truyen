import { Inject, Injectable } from '@nestjs/common';
import { SEARCH_QUERY_PORT, type SearchQueryPort } from '../ports/search.port';
import type { SearchInput } from '../../domain/search.models';
import { validateSearchInput } from '../../domain/policies/search-text.policy';

@Injectable()
export class SearchQueryHandler {
  constructor(
    @Inject(SEARCH_QUERY_PORT) private readonly searchPort: SearchQueryPort,
  ) {}
  execute(input: SearchInput, viewerId?: string) {
    return this.searchPort.search(validateSearchInput(input), viewerId);
  }
  filters() {
    return this.searchPort.filters();
  }
}

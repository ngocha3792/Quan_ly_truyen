import type {
  PublicStoryListSort,
  PublicStoryListStatus,
} from '../../ports';

export class ListPublicStoriesQuery {
  constructor(
    readonly q: string | undefined,
    readonly genre: string | undefined,
    readonly status: PublicStoryListStatus | undefined,
    readonly sort: PublicStoryListSort,
    readonly yearFrom: number | undefined,
    readonly yearTo: number | undefined,
    readonly page: number,
    readonly pageSize: number,
  ) {}
}

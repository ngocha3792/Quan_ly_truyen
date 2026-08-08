import type { AuthorApplicationStatus } from '../../../domain';

export class ListAuthorApplicationsQuery {
  constructor(
    readonly status: AuthorApplicationStatus | undefined,

    readonly offset: number,

    readonly limit: number,
  ) {}
}

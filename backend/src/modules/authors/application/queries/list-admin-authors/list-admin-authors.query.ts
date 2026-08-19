import type { AuthorLifecycleStatus } from '../../../domain';
export class ListAdminAuthorsQuery {
  constructor(
    readonly input: {
      search?: string;
      status?: AuthorLifecycleStatus;
      createdFrom?: Date;
      createdTo?: Date;
      page: number;
      pageSize: number;
    },
  ) {}
}

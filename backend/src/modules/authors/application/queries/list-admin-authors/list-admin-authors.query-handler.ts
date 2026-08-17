import { Inject, Injectable } from '@nestjs/common';
import type { AdminAuthorListDto } from '../../dto';
import { AUTHOR_LIFECYCLE_PERSISTENCE_PORT, type AuthorLifecyclePersistencePort } from '../../ports';
import { ListAdminAuthorsQuery } from './list-admin-authors.query';
@Injectable()
export class ListAdminAuthorsQueryHandler {
  constructor(@Inject(AUTHOR_LIFECYCLE_PERSISTENCE_PORT) private readonly persistence: AuthorLifecyclePersistencePort) {
  }
  execute(query: ListAdminAuthorsQuery): Promise<AdminAuthorListDto> {
    return this.persistence.list(query.input);
  }
}

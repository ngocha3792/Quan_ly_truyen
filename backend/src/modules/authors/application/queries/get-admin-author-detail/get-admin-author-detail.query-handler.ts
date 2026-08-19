import { Inject, Injectable } from '@nestjs/common';
import type { AdminAuthorDetailDto } from '../../dto';
import {
  AUTHOR_LIFECYCLE_PERSISTENCE_PORT,
  type AuthorLifecyclePersistencePort,
} from '../../ports';
import { GetAdminAuthorDetailQuery } from './get-admin-author-detail.query';
@Injectable()
export class GetAdminAuthorDetailQueryHandler {
  constructor(
    @Inject(AUTHOR_LIFECYCLE_PERSISTENCE_PORT)
    private readonly persistence: AuthorLifecyclePersistencePort,
  ) {}
  execute(query: GetAdminAuthorDetailQuery): Promise<AdminAuthorDetailDto> {
    return this.persistence.detail(query.authorId);
  }
}

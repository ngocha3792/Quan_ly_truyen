import { Inject, Injectable } from '@nestjs/common';
import {
  AUTHOR_LIFECYCLE_PERSISTENCE_PORT,
  type AuthorLifecyclePersistencePort,
} from '../../ports';
import { AssertActiveAuthorQuery } from './assert-active-author.query';
@Injectable()
export class AssertActiveAuthorQueryHandler {
  constructor(
    @Inject(AUTHOR_LIFECYCLE_PERSISTENCE_PORT)
    private readonly persistence: AuthorLifecyclePersistencePort,
  ) {}
  execute(query: AssertActiveAuthorQuery): Promise<void> {
    return this.persistence.assertActiveAuthor(query.userId);
  }
}

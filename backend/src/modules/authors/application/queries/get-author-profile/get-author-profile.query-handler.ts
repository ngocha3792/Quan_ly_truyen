import { Inject, Injectable } from '@nestjs/common';
import type { AuthorProfileView } from '../../dto';
import {
  AUTHOR_PROFILE_PERSISTENCE_PORT,
  type AuthorProfilePersistencePort,
} from '../../ports';
import { GetAuthorProfileQuery } from './get-author-profile.query';
@Injectable()
export class GetAuthorProfileQueryHandler {
  constructor(
    @Inject(AUTHOR_PROFILE_PERSISTENCE_PORT)
    private readonly persistence: AuthorProfilePersistencePort,
  ) {}
  execute(query: GetAuthorProfileQuery): Promise<AuthorProfileView> {
    return this.persistence.get(query.userId);
  }
}

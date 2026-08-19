import { Inject, Injectable } from '@nestjs/common';
import type { AuthorProfileView } from '../../dto';
import {
  AUTHOR_PROFILE_PERSISTENCE_PORT,
  type AuthorProfilePersistencePort,
} from '../../ports';
import { UpdateAuthorProfileCommand } from './update-author-profile.command';
@Injectable()
export class UpdateAuthorProfileCommandHandler {
  constructor(
    @Inject(AUTHOR_PROFILE_PERSISTENCE_PORT)
    private readonly persistence: AuthorProfilePersistencePort,
  ) {}
  execute(command: UpdateAuthorProfileCommand): Promise<AuthorProfileView> {
    return this.persistence.update(command.input);
  }
}

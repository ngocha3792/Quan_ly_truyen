import { Inject, Injectable } from '@nestjs/common';
import type { AdminAuthorDetailDto } from '../../dto';
import { AUTHOR_LIFECYCLE_PERSISTENCE_PORT, type AuthorLifecyclePersistencePort } from '../../ports';
import { ChangeAuthorStatusCommand } from './change-author-status.command';
@Injectable()
export class ChangeAuthorStatusCommandHandler {
  constructor(@Inject(AUTHOR_LIFECYCLE_PERSISTENCE_PORT) private readonly persistence: AuthorLifecyclePersistencePort) {
  }
  execute(command: ChangeAuthorStatusCommand): Promise<AdminAuthorDetailDto> {
    return this.persistence.changeStatus(command.input);
  }
}

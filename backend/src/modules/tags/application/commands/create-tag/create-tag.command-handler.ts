import { Inject, Injectable } from '@nestjs/common';
import { normalizeTagName } from '../../../domain';
import { TAG_REPOSITORY, type TagRepositoryPort } from '../../ports';
import { CreateTagCommand } from './create-tag.command';
@Injectable()
export class CreateTagCommandHandler {
  constructor(
    @Inject(TAG_REPOSITORY) private readonly repository: TagRepositoryPort,
  ) {}
  execute(command: CreateTagCommand) {
    return this.repository.create(
      normalizeTagName(command.name),
      command.audit,
    );
  }
}

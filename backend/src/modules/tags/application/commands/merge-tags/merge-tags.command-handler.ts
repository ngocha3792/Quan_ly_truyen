import { Inject, Injectable } from '@nestjs/common';
import { TagCannotMergeIntoSelfException } from '../../../domain';
import { TAG_REPOSITORY, type TagRepositoryPort } from '../../ports';
import { MergeTagsCommand } from './merge-tags.command';
@Injectable()
export class MergeTagsCommandHandler {
  constructor(@Inject(TAG_REPOSITORY) private readonly repository: TagRepositoryPort) {
  }
  execute(command: MergeTagsCommand) {
    if (command.sourceTagId === command.targetTagId) throw new TagCannotMergeIntoSelfException();
    return this.repository.merge(command.sourceTagId, command.targetTagId, command.audit);
  }
}

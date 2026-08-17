import { Inject, Injectable } from '@nestjs/common';
import { normalizeTagName, TagCannotMergeIntoSelfException } from '../domain';
import {
  TAG_REPOSITORY,
  type TagRepositoryPort,
} from './ports/tag.repository.port';
import type { ListTagsInput, TagAuditContext } from './tag.models';

@Injectable()
export class TagsService {
  constructor(
    @Inject(TAG_REPOSITORY) private readonly repository: TagRepositoryPort,
  ) {}

  list(input: ListTagsInput) {
    return this.repository.list(input);
  }

  create(nameInput: string, audit: TagAuditContext) {
    return this.repository.create(normalizeTagName(nameInput), audit);
  }

  update(id: string, nameInput: string, audit: TagAuditContext) {
    return this.repository.update(id, normalizeTagName(nameInput), audit);
  }

  delete(id: string, audit: TagAuditContext) {
    return this.repository.delete(id, audit);
  }

  merge(sourceTagId: string, targetTagId: string, audit: TagAuditContext) {
    if (sourceTagId === targetTagId) throw new TagCannotMergeIntoSelfException();
    return this.repository.merge(sourceTagId, targetTagId, audit);
  }
}

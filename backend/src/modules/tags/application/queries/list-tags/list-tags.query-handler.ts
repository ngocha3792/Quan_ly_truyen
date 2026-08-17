import { Inject, Injectable } from '@nestjs/common';
import { TAG_REPOSITORY, type TagRepositoryPort } from '../../ports';
import { ListTagsQuery } from './list-tags.query';
@Injectable()
export class ListTagsQueryHandler { constructor(@Inject(TAG_REPOSITORY) private readonly repository: TagRepositoryPort) {} execute(query: ListTagsQuery) { return this.repository.list(query.input); } }

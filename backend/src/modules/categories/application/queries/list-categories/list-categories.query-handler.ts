import { Inject, Injectable } from '@nestjs/common';
import { CATEGORY_REPOSITORY, type CategoryRepositoryPort } from '../../ports';
import { ListCategoriesQuery } from './list-categories.query';
@Injectable()
export class ListCategoriesQueryHandler {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly repository: CategoryRepositoryPort,
  ) {}
  execute(query: ListCategoriesQuery) {
    return this.repository.list(query.input);
  }
}

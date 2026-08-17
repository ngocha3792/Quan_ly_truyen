import { Inject, Injectable } from '@nestjs/common';
import { normalizeCategoryName } from '../domain';
import {
  CATEGORY_REPOSITORY,
  type CategoryRepositoryPort,
} from './ports/category.repository.port';
import type {
  CategoryAuditContext,
  CreateCategoryInput,
  ListCategoriesInput,
  UpdateCategoryInput,
} from './category.models';

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly repository: CategoryRepositoryPort,
  ) {}

  list(input: ListCategoriesInput) {
    return this.repository.list(input);
  }

  create(input: CreateCategoryInput, audit: CategoryAuditContext) {
    return this.repository.create(
      { ...input, name: normalizeCategoryName(input.name) },
      audit,
    );
  }

  update(id: string, input: UpdateCategoryInput, audit: CategoryAuditContext) {
    return this.repository.update(
      id,
      {
        ...input,
        ...(input.name === undefined
          ? {}
          : { name: normalizeCategoryName(input.name) }),
      },
      audit,
    );
  }

  delete(id: string, audit: CategoryAuditContext) {
    return this.repository.delete(id, audit);
  }
}

import type {
  AdminCategoryItem,
  AdminCategoryList,
  CategoryAuditContext,
  CreateCategoryInput,
  ListCategoriesInput,
  UpdateCategoryInput,
} from '../dto';

export const CATEGORY_REPOSITORY = Symbol.for('modules.categories.repository');

export interface CategoryRepositoryPort {
  list(input: ListCategoriesInput): Promise<AdminCategoryList>;
  create(
    input: CreateCategoryInput,
    audit: CategoryAuditContext,
  ): Promise<AdminCategoryItem>;
  update(
    id: string,
    input: UpdateCategoryInput,
    audit: CategoryAuditContext,
  ): Promise<AdminCategoryItem>;
  delete(id: string, audit: CategoryAuditContext): Promise<void>;
}

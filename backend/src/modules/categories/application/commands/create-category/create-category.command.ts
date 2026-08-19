import type { CategoryAuditContext, CreateCategoryInput } from '../../dto';
export class CreateCategoryCommand {
  constructor(
    readonly input: CreateCategoryInput,
    readonly audit: CategoryAuditContext,
  ) {}
}

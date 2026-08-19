import type { CategoryAuditContext, UpdateCategoryInput } from '../../dto';
export class UpdateCategoryCommand {
  constructor(
    readonly id: string,
    readonly input: UpdateCategoryInput,
    readonly audit: CategoryAuditContext,
  ) {}
}

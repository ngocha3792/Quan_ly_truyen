import type { CategoryAuditContext } from '../../dto';
export class DeleteCategoryCommand {
  constructor(
    readonly id: string,
    readonly audit: CategoryAuditContext,
  ) {}
}

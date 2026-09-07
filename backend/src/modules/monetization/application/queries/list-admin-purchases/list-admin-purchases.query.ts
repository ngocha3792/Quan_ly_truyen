import type { ChapterPurchaseStatusName } from '../../../domain';

export class ListAdminPurchasesQuery {
  constructor(
    public readonly page: number,
    public readonly pageSize: number,
    public readonly status?: ChapterPurchaseStatusName,
    public readonly search?: string,
    public readonly userId?: string,
    public readonly storyId?: string,
    public readonly authorId?: string,
    public readonly from?: string,
    public readonly to?: string,
  ) {}
}

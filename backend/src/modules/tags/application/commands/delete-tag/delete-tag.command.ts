import type { TagAuditContext } from '../../dto';
export class DeleteTagCommand {
  constructor(
    readonly id: string,
    readonly audit: TagAuditContext,
  ) {}
}

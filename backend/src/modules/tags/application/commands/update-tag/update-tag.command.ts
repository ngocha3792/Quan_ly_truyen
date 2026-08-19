import type { TagAuditContext } from '../../dto';
export class UpdateTagCommand {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly audit: TagAuditContext,
  ) {}
}

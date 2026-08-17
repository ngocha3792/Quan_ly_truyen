import type { TagAuditContext } from '../../dto';
export class CreateTagCommand { constructor(readonly name: string, readonly audit: TagAuditContext) {} }

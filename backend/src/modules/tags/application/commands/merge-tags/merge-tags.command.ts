import type { TagAuditContext } from '../../dto';
export class MergeTagsCommand { constructor(readonly sourceTagId: string, readonly targetTagId: string, readonly audit: TagAuditContext) {} }

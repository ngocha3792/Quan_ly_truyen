import type { ReportAuditContext } from '../../dto';
export class ResolveReportCommand { constructor(readonly actorId: string, readonly reportId: string, readonly note: string, readonly audit: ReportAuditContext) {} }

import { Inject, Injectable } from '@nestjs/common';
import { InvalidReportResolutionException } from '../domain';
import {
  REPORT_REPOSITORY,
  type ReportRepositoryPort,
} from './ports/report.repository.port';
import type { AdminReportListQuery, ReportAuditContext } from './report.models';

@Injectable()
export class ReportsService {
  constructor(
    @Inject(REPORT_REPOSITORY) private readonly repository: ReportRepositoryPort,
  ) {}

  list(query: AdminReportListQuery) {
    return this.repository.list(query);
  }

  get(reportId: string) {
    return this.repository.get(reportId);
  }

  resolve(input: {
    actorId: string;
    reportId: string;
    note: string;
    audit: ReportAuditContext;
  }) {
    return this.close({
      ...input,
      status: 'RESOLVED',
      auditAction: 'comment.report.resolved',
    });
  }

  reject(input: {
    actorId: string;
    reportId: string;
    note: string;
    audit: ReportAuditContext;
  }) {
    return this.close({
      ...input,
      status: 'REJECTED',
      auditAction: 'comment.report.rejected',
    });
  }

  private close(input: {
    actorId: string;
    reportId: string;
    note: string;
    status: 'RESOLVED' | 'REJECTED';
    auditAction: string;
    audit: ReportAuditContext;
  }) {
    const note = input.note.normalize('NFKC').trim();
    if (note.length < 10 || note.length > 2000)
      throw new InvalidReportResolutionException();
    return this.repository.close({ ...input, note });
  }
}

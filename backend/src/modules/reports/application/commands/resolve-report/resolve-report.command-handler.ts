import { Inject, Injectable } from '@nestjs/common';
import { InvalidReportResolutionException } from '../../../domain';
import { REPORT_REPOSITORY, type ReportRepositoryPort } from '../../ports';
import { ResolveReportCommand } from './resolve-report.command';
@Injectable()
export class ResolveReportCommandHandler {
  constructor(
    @Inject(REPORT_REPOSITORY)
    private readonly repository: ReportRepositoryPort,
  ) {}
  execute(command: ResolveReportCommand) {
    const note = command.note.normalize('NFKC').trim();
    if (note.length < 10 || note.length > 2000)
      throw new InvalidReportResolutionException();
    return this.repository.close({
      actorId: command.actorId,
      reportId: command.reportId,
      note,
      status: 'RESOLVED',
      auditAction: 'comment.report.resolved',
      audit: command.audit,
    });
  }
}

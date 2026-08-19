import { Inject, Injectable } from '@nestjs/common';
import { InvalidReportResolutionException } from '../../../domain';
import { REPORT_REPOSITORY, type ReportRepositoryPort } from '../../ports';
import { RejectReportCommand } from './reject-report.command';
@Injectable()
export class RejectReportCommandHandler {
  constructor(
    @Inject(REPORT_REPOSITORY)
    private readonly repository: ReportRepositoryPort,
  ) {}
  execute(command: RejectReportCommand) {
    const note = command.note.normalize('NFKC').trim();
    if (note.length < 10 || note.length > 2000)
      throw new InvalidReportResolutionException();
    return this.repository.close({
      actorId: command.actorId,
      reportId: command.reportId,
      note,
      status: 'REJECTED',
      auditAction: 'comment.report.rejected',
      audit: command.audit,
    });
  }
}

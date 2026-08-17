import { Inject, Injectable } from '@nestjs/common';
import { REPORT_REPOSITORY, type ReportRepositoryPort } from '../../ports';
import { GetReportQuery } from './get-report.query';
@Injectable()
export class GetReportQueryHandler {
  constructor(@Inject(REPORT_REPOSITORY) private readonly repository: ReportRepositoryPort) {
  }
  execute(query: GetReportQuery) {
    return this.repository.get(query.reportId);
  }
}

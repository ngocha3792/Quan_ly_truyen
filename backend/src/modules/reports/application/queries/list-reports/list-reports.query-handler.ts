import { Inject, Injectable } from '@nestjs/common';
import { REPORT_REPOSITORY, type ReportRepositoryPort } from '../../ports';
import { ListReportsQuery } from './list-reports.query';
@Injectable()
export class ListReportsQueryHandler {
  constructor(@Inject(REPORT_REPOSITORY) private readonly repository: ReportRepositoryPort) {
  }
  execute(query: ListReportsQuery) {
    return this.repository.list(query.input);
  }
}

import type {
  AdminReportListQuery,
  CloseReportPersistenceInput,
} from '../dto';

export const REPORT_REPOSITORY = Symbol.for('modules.reports.repository');

export interface ReportRepositoryPort {
  list(query: AdminReportListQuery): Promise<unknown>;
  get(reportId: string): Promise<unknown>;
  close(input: CloseReportPersistenceInput): Promise<unknown>;
}

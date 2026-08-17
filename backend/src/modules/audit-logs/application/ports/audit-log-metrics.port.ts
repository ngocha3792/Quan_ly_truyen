export interface AuditLogMetricsPort {
  recordRead(operation: 'list' | 'detail', outcome: 'success' | 'error'): void;
}

export const AUDIT_LOG_METRICS_PORT = Symbol('AUDIT_LOG_METRICS_PORT');

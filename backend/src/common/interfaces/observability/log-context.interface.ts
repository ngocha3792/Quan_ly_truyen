export interface LogContext {
  requestId?: string;
  correlationId?: string;
  traceId?: string;

  userId?: string;
  sessionId?: string;

  module?: string;
  action?: string;

  metadata?: Record<string, unknown>;
}

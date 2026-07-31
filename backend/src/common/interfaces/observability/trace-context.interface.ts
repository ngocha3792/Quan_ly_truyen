export interface TraceContext {
  traceId: string;
  spanId?: string;
  parentSpanId?: string;
}

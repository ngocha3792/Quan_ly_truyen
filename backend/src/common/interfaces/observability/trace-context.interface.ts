export interface TraceContext {
  traceId: string;
  spanId?: string;
  parentSpanId?: string;
}

export interface TraceCarrier {
  traceparent?: string;
  tracestate?: string;
}

export interface QueueTelemetryMetadata {
  schemaVersion: 1;
  correlationId?: string;
  causationId?: string;
  traceId?: string;
  source: 'api' | 'worker' | 'system';
  traceContext?: TraceCarrier;
}

export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  traceId?: string;

  actorId?: string;
  source: string;

  schemaVersion: number;
}

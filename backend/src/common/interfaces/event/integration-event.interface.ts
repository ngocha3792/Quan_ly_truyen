import { EventMetadata } from './event-metadata.interface';

export interface IntegrationEvent<
  TPayload extends object = Record<string, unknown>,
> {
  id: string;
  type: string;
  version: number;

  source: string;
  occurredAt: string;

  payload: TPayload;
  metadata: EventMetadata;
}

import { EventMetadata } from './event-metadata.interface';

export interface DomainEvent<
    TPayload extends object = Record<string, unknown>,
> {
    eventId: string;
    eventName: string;

    aggregateType: string;
    aggregateId: string;

    occurredAt: Date;
    payload: TPayload;

    metadata: EventMetadata;
}
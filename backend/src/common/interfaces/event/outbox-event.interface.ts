export interface OutboxEvent {
    id: string;

    aggregateType: string;
    aggregateId: string;

    eventType: string;
    payload: Record<string, unknown>;

    occurredAt: Date;
    processedAt: Date | null;

    retryCount: number;
    lastError: string | null;
}
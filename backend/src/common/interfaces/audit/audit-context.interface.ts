import { AuditActor } from './audit-actor.interface';

export interface AuditContext {
    actor: AuditActor;

    requestId?: string;
    correlationId?: string;
    traceId?: string;

    ipAddress?: string;
    userAgent?: string;
}
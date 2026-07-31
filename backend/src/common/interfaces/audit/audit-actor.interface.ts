export type AuditActorType =
    | 'USER'
    | 'SYSTEM'
    | 'JOB'
    | 'WEBHOOK';

export interface AuditActor {
    type: AuditActorType;

    userId?: string;
    sessionId?: string;
    jobName?: string;
    externalSystem?: string;
}
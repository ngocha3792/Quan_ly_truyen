export interface AuditFieldChange {
    field: string;
    previousValue: unknown;
    currentValue: unknown;
}

export interface AuditChangeSet {
    entityType: string;
    entityId: string;

    action:
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'RESTORE'
    | 'PUBLISH'
    | 'SUSPEND';

    changes?: readonly AuditFieldChange[];
}
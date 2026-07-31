export interface ExecutionMetadata {
    operation: string;
    module: string;

    startedAt: Date;
    durationMs?: number;

    success?: boolean;
}
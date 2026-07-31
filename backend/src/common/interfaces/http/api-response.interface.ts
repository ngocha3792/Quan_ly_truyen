export interface ApiResponse<T> {
    success: true;
    data: T;

    message?: string;
    meta?: Record<string, unknown>;

    requestId: string;
    timestamp: string;
}
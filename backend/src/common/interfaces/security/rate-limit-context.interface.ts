export interface RateLimitContext {
    key: string;

    limit: number;
    remaining: number;

    resetAt: Date;
}
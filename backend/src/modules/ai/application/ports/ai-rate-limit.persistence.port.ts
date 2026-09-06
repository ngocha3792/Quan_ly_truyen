export const AI_RATE_LIMIT_PERSISTENCE_PORT = Symbol.for(
  'modules.ai.rate-limit-persistence',
);

export interface ReserveAiRateLimitInput {
  readonly userId: string;
  readonly windowStart: Date;
  readonly requestLimit: number;
  readonly tokenLimit: number;
  readonly tokens: number;
}

export interface AiRateLimitBucketRecord {
  readonly requestCount: number;
  readonly tokenCount: number;
}

export interface AiRateLimitReservationResult {
  readonly allowed: boolean;
  readonly bucket: AiRateLimitBucketRecord;
}

export interface AiRateLimitPersistencePort {
  reserve(
    input: ReserveAiRateLimitInput,
  ): Promise<AiRateLimitReservationResult>;

  reconcileTokens(
    userId: string,
    windowStart: Date,
    reservedTokens: number,
    actualTokens: number,
  ): Promise<void>;
}

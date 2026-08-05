export interface ApiSuccessEnvelope<T> {
  readonly success: true;
  readonly data: T;
  readonly message?: string;
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly requestId: string;
  readonly timestamp: string;
}

export interface ApiErrorEnvelope {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly retryable: boolean;
  };
  readonly requestId: string;
  readonly timestamp: string;
  readonly path: string;
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

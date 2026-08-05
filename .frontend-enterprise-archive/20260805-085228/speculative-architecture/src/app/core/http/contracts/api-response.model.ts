export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly message?: string;
  readonly meta?: Record<string, unknown>;
  readonly requestId: string;
  readonly timestamp: string;
}

export interface ApiErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
    readonly retryable: boolean;
  };
  readonly requestId: string;
  readonly timestamp: string;
  readonly path: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

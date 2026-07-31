export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  requestId: string;
  timestamp: string;
}

export interface ApiErrorEnvelopeLike {
  success: false;
  error: unknown;
}

export type ApiEnvelope<T> =
  | ApiSuccessResponse<T>
  | ApiErrorEnvelopeLike;

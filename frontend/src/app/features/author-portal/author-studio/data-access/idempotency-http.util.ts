import { HttpHeaders } from '@angular/common/http';

export function idempotencyHeaders(key: string = crypto.randomUUID()): HttpHeaders {
  return new HttpHeaders({ 'x-idempotency-key': key });
}

export interface CreateRetryState {
  readonly identity: string;
  readonly key: string;
}

export function reuseCreateKey(
  current: CreateRetryState | null,
  payload: unknown,
): CreateRetryState {
  const identity = JSON.stringify(payload) ?? 'undefined';
  if (current?.identity === identity) return current;
  return { identity, key: crypto.randomUUID() };
}

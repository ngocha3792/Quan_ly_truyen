export type PublicExceptionDetails = Readonly<Record<string, unknown>>;

/**
 * Transport-ready error after an unknown exception has been normalized.
 */
export interface NormalizedException {
  status: number;
  code: string;
  message: string;
  details?: PublicExceptionDetails;
  retryable: boolean;
  logLevel: 'warn' | 'error';
}

import { HttpErrorResponse } from '@angular/common/http';

import { MfaChallengeDetails } from '../../../../../core/auth/auth.models';
import { ApiErrorEnvelope } from '../../../../../core/http/api-envelope.model';

export function readApiErrorCode(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body = error.error as Partial<ApiErrorEnvelope> | undefined;
  return typeof body?.error?.code === 'string' ? body.error.code : null;
}

export function readMfaChallenge(error: unknown): MfaChallengeDetails | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body = error.error as Partial<ApiErrorEnvelope> | undefined;
  const code = body?.error?.code;
  if (
    ![
      'AUTH_MFA_REQUIRED',
      'AUTH_MFA_ENROLLMENT_REQUIRED',
      'AUTH_ADMIN_MFA_REQUIRED',
      'AUTH_ADMIN_MFA_ENROLLMENT_REQUIRED',
    ].includes(code ?? '')
  )
    return null;

  const details = body?.error?.details;
  const mfaTicket = details?.['mfaTicket'];
  const mode = details?.['mode'];
  const expiresAt = details?.['expiresAt'];
  if (
    typeof mfaTicket !== 'string' ||
    (mode !== 'enroll' && mode !== 'verify') ||
    typeof expiresAt !== 'string'
  )
    return null;
  return { mfaTicket, mode, expiresAt };
}

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  return Boolean(email && email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

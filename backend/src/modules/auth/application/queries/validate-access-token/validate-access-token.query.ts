import type { AccessTokenPayload } from '@/common/interfaces/auth';

export class ValidateAccessTokenQuery {
  constructor(readonly payload: AccessTokenPayload) {}
}

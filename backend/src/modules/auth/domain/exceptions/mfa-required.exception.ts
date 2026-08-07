import { PreconditionFailedException } from '@/common/exceptions';

import type { MfaChallengeResult } from '../../application/ports';

export class MfaRequiredException extends PreconditionFailedException {
  constructor(challenge: MfaChallengeResult) {
    super({
      code:
        challenge.mode === 'enroll'
          ? 'AUTH_MFA_ENROLLMENT_REQUIRED'
          : 'AUTH_MFA_REQUIRED',

      message:
        challenge.mode === 'enroll'
          ? 'Tài khoản phải thiết lập MFA trước khi hoàn tất đăng nhập'
          : 'Cần xác minh MFA để hoàn tất đăng nhập',

      details: {
        mfaTicket: challenge.ticket,

        mode: challenge.mode,

        expiresAt: challenge.expiresAt.toISOString(),
      },
    });
  }
}

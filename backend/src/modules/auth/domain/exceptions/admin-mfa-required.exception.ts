import { PreconditionFailedException } from '@/common/exceptions';

import type { AdminMfaChallengeResult } from '../../application/ports';

export class AdminMfaRequiredException extends PreconditionFailedException {
  constructor(challenge: AdminMfaChallengeResult) {
    super({
      code:
        challenge.mode === 'enroll'
          ? 'AUTH_ADMIN_MFA_ENROLLMENT_REQUIRED'
          : 'AUTH_ADMIN_MFA_REQUIRED',
      message:
        challenge.mode === 'enroll'
          ? 'Quản trị viên phải đăng ký MFA trước khi đăng nhập'
          : 'Cần xác minh MFA để hoàn tất đăng nhập quản trị viên',
      details: {
        mfaTicket: challenge.ticket,
        mode: challenge.mode,
        expiresAt: challenge.expiresAt.toISOString(),
      },
    });
  }
}

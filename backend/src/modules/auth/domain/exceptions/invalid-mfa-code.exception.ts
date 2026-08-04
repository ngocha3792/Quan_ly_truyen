import { AppException, ExceptionCategory } from '@/common/exceptions';

export class InvalidMfaCodeException extends AppException {
  constructor(attemptsRemaining?: number) {
    super({
      code: 'AUTH_MFA_CODE_INVALID',
      message: 'Mã xác minh MFA không hợp lệ',
      category: ExceptionCategory.UNAUTHORIZED,
      details:
        attemptsRemaining === undefined ? undefined : { attemptsRemaining },
    });
  }
}

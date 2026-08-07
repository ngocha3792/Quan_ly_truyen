import { AccessDeniedException } from '@/common/exceptions';

export class SecurityQuestionsUnavailableException extends AccessDeniedException {
  constructor() {
    super({
      code: 'AUTH_SECURITY_QUESTIONS_PASSWORD_REQUIRED',

      message: 'Tài khoản cần có mật khẩu trước khi cấu hình câu hỏi bảo mật',
    });
  }
}

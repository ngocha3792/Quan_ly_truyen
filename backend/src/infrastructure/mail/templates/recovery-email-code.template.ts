import type { MailTemplate } from '../contracts';
import {
  emailLayout,
  escapeHtml,
  requiredNumber,
  requiredString,
} from './shared';
import { MailTemplateId } from './mail-template-id.enum';

export const recoveryEmailCodeTemplate: MailTemplate = {
  id: MailTemplateId.RECOVERY_EMAIL_CODE,

  render(variables) {
    const name = escapeHtml(requiredString(variables, 'displayName'));

    const code = escapeHtml(requiredString(variables, 'code'));

    const minutes = requiredNumber(variables, 'expiresInMinutes');

    const subject = 'Mã xác minh email khôi phục';

    const body = [
      `<p>Xin chào ${name},</p>`,
      '<p>Mã xác minh email khôi phục của bạn là:</p>',
      `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>`,
      `<p>Mã hết hạn sau ${minutes} phút.</p>`,
      '<p>Nếu bạn không yêu cầu thao tác này, hãy kiểm tra lại bảo mật tài khoản.</p>',
    ].join('');

    return {
      subject,
      text:
        `Mã xác minh email khôi phục của bạn là ${code}. ` +
        `Mã hết hạn sau ${minutes} phút.`,
      html: emailLayout(subject, body),
      tags: ['security', 'recovery-email'],
    };
  },
};

import type { MailTemplate } from '../contracts';
import {
  emailLayout,
  escapeHtml,
  requiredNumber,
  requiredString,
  safeLink,
} from './shared';
import { MailTemplateId } from './mail-template-id.enum';

export const emailVerificationTemplate: MailTemplate = {
  id: MailTemplateId.EMAIL_VERIFICATION,
  render(variables) {
    const name = escapeHtml(requiredString(variables, 'displayName'));
    const url = safeLink(variables.verificationUrl, 'verificationUrl');
    const minutes = requiredNumber(variables, 'expiresInMinutes');
    const subject = 'Xác thực tài khoản Quan Ly Truyen';
    const body = `<p>Xin chào ${name},</p><p>Hãy xác thực địa chỉ email của bạn.</p><p><a class="button" href="${url}">Xác thực email</a></p><p>Liên kết hết hạn sau ${minutes} phút.</p>`;
    return {
      subject,
      text: `Xin chào ${requiredString(variables, 'displayName')}. Xác thực email: ${String(variables.verificationUrl)}. Liên kết hết hạn sau ${minutes} phút.`,
      html: emailLayout(subject, body),
      tags: ['security', 'verification'],
    };
  },
};

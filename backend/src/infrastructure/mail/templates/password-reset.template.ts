import type { MailTemplate } from '../contracts';
import {
  emailLayout,
  escapeHtml,
  requiredNumber,
  requiredString,
  safeLink,
} from './shared';
import { MailTemplateId } from './mail-template-id.enum';

export const passwordResetTemplate: MailTemplate = {
  id: MailTemplateId.PASSWORD_RESET,
  render(variables) {
    const name = escapeHtml(requiredString(variables, 'displayName'));
    const url = safeLink(variables.resetUrl, 'resetUrl');
    const minutes = requiredNumber(variables, 'expiresInMinutes');
    const subject = 'Đặt lại mật khẩu Quan Ly Truyen';
    const body = `<p>Xin chào ${name},</p><p>Bạn vừa yêu cầu đặt lại mật khẩu.</p><p><a class="button" href="${url}">Đặt lại mật khẩu</a></p><p>Liên kết hết hạn sau ${minutes} phút. Nếu không yêu cầu, hãy bỏ qua email này.</p>`;
    return {
      subject,
      text: `Đặt lại mật khẩu: ${String(variables.resetUrl)}. Liên kết hết hạn sau ${minutes} phút.`,
      html: emailLayout(subject, body),
      tags: ['security', 'password-reset'],
    };
  },
};

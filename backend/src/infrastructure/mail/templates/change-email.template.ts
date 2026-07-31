import type { MailTemplate } from '../contracts';
import { emailLayout, escapeHtml, requiredString, safeLink } from './shared';
import { MailTemplateId } from './mail-template-id.enum';

export const changeEmailTemplate: MailTemplate = {
  id: MailTemplateId.CHANGE_EMAIL,
  render(variables) {
    const name = escapeHtml(requiredString(variables, 'displayName'));
    const url = safeLink(variables.confirmationUrl, 'confirmationUrl');
    const subject = 'Xác nhận thay đổi email';
    const body = `<p>Xin chào ${name},</p><p><a class="button" href="${url}">Xác nhận email mới</a></p>`;
    return {
      subject,
      text: `Xác nhận email mới: ${String(variables.confirmationUrl)}`,
      html: emailLayout(subject, body),
      tags: ['security', 'change-email'],
    };
  },
};

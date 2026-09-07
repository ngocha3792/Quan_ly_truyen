import type { MailTemplate } from '../contracts';
import { emailLayout, escapeHtml, requiredString, safeLink } from './shared';
import { MailTemplateId } from './mail-template-id.enum';

export const creditActivityTemplate: MailTemplate = {
  id: MailTemplateId.CREDIT_ACTIVITY,
  render(variables) {
    const displayName = escapeHtml(requiredString(variables, 'displayName'));
    const title = requiredString(variables, 'title');
    const body = escapeHtml(requiredString(variables, 'body'));
    const amountCredits = escapeHtml(
      requiredString(variables, 'amountCredits'),
    );
    const transactionId = escapeHtml(
      requiredString(variables, 'transactionId'),
    );
    const actionUrl = safeLink(variables.actionUrl, 'actionUrl');

    return {
      subject: title,
      text: `Chào ${requiredString(variables, 'displayName')}. ${requiredString(variables, 'body')} Số Credit: ${requiredString(variables, 'amountCredits')}. Mã giao dịch: ${requiredString(variables, 'transactionId')}. ${String(variables.actionUrl)}`,
      html: emailLayout(
        title,
        `<p>Chào <strong>${displayName}</strong>,</p><p>${body}</p><table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0"><tr><td style="padding:12px;border:1px solid #e5e7eb"><strong>${amountCredits} Credit</strong><br><span class="muted">Giá trị giao dịch</span></td></tr></table><p class="muted">Mã giao dịch: ${transactionId}</p><p><a class="button" href="${actionUrl}">Xem ví Credit</a></p>`,
      ),
      tags: ['transactional', 'credit-activity'],
    };
  },
};

import type { MailTemplate } from '../contracts';
import { emailLayout, escapeHtml, requiredString, safeLink } from './shared';
import { MailTemplateId } from './mail-template-id.enum';

export const moderationResultTemplate: MailTemplate = {
  id: MailTemplateId.MODERATION_RESULT,
  render(variables) {
    const story = escapeHtml(requiredString(variables, 'storyTitle'));
    const result = escapeHtml(requiredString(variables, 'result'));
    const url = safeLink(variables.storyUrl, 'storyUrl');
    const subject = `Kết quả kiểm duyệt: ${requiredString(variables, 'storyTitle')}`;
    const body = `<p>Truyện <strong>${story}</strong> có kết quả: ${result}.</p><p><a class="button" href="${url}">Xem truyện</a></p>`;
    return {
      subject,
      text: `Kết quả kiểm duyệt truyện ${requiredString(variables, 'storyTitle')}: ${requiredString(variables, 'result')}. ${String(variables.storyUrl)}`,
      html: emailLayout(subject, body),
      tags: ['moderation'],
    };
  },
};

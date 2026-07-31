import type { MailTemplate } from '../contracts';
import { emailLayout, escapeHtml, requiredString, safeLink } from './shared';
import { MailTemplateId } from './mail-template-id.enum';

export const newChapterTemplate: MailTemplate = {
  id: MailTemplateId.NEW_CHAPTER,
  render(variables) {
    const story = escapeHtml(requiredString(variables, 'storyTitle'));
    const chapter = escapeHtml(requiredString(variables, 'chapterTitle'));
    const url = safeLink(variables.chapterUrl, 'chapterUrl');
    const subject = `${requiredString(variables, 'storyTitle')} có chương mới`;
    const body = `<p><strong>${story}</strong> vừa cập nhật chương mới: ${chapter}.</p><p><a class="button" href="${url}">Đọc ngay</a></p>`;
    return {
      subject,
      text: `${requiredString(variables, 'storyTitle')} - ${requiredString(variables, 'chapterTitle')}: ${String(variables.chapterUrl)}`,
      html: emailLayout(subject, body),
      tags: ['notification', 'new-chapter'],
    };
  },
};

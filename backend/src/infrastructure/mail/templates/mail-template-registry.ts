import { Injectable } from '@nestjs/common';

import type { MailTemplate } from '../contracts';
import { MailTemplateNotFoundException } from '../exceptions';
import { changeEmailTemplate } from './change-email.template';
import { emailVerificationTemplate } from './email-verification.template';
import { moderationResultTemplate } from './moderation-result.template';
import { newChapterTemplate } from './new-chapter.template';
import { passwordResetTemplate } from './password-reset.template';

@Injectable()
export class MailTemplateRegistry {
  private readonly templates = new Map<string, MailTemplate>(
    [
      emailVerificationTemplate,
      passwordResetTemplate,
      changeEmailTemplate,
      moderationResultTemplate,
      newChapterTemplate,
    ].map((template) => [template.id, template]),
  );

  get(templateId: string): MailTemplate {
    const template = this.templates.get(templateId);
    if (!template) throw new MailTemplateNotFoundException(templateId);
    return template;
  }
}
